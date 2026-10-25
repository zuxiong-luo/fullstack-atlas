import "reflect-metadata";
import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  ValidationPipe,
  Headers,
  BadRequestException,
  GatewayTimeoutException,
  UseGuards,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { IsString, MinLength, MaxLength } from "class-validator";
import type { Request, Response } from "express";
import { AuditEntity, NoteEntity, OwnerEntity } from "./model";
import { databaseUrl } from "./config";
import { DurableJobs } from "./reliability";
import { IdentityGuard, Identity, AuthRequest } from "./auth";
const UPSTREAM = Symbol("UPSTREAM");
export type Options = {
  url: string;
  budgetMs: number;
  waitOnDatabaseLock?: boolean;
};
class TitleInput {
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
}
@Injectable()
export class PreviewService {
  active = 0;
  cancelled = 0;
  constructor(
    private readonly ds: DataSource,
    @Inject(UPSTREAM) private readonly options: Options,
  ) {}
  async create(identity: Identity, title: string, disconnect: AbortSignal) {
    const signal = AbortSignal.any([
      disconnect,
      AbortSignal.timeout(this.options.budgetMs),
    ]);
    this.active++;
    let phase: "upstream" | "database" = "upstream";
    try {
      const response = await fetch(this.options.url, { signal });
      if (!response.ok)
        throw new ServiceUnavailableException("upstream failed");
      await response.text();
      signal.throwIfAborted();
      phase = "database";
      return await this.ds.transaction(async (manager) => {
        signal.throwIfAborted();
        if (this.options.waitOnDatabaseLock)
          await manager.query(
            "SELECT pg_advisory_xact_lock(642) /* nest-preview-barrier */",
          );
        const note = await manager.getRepository(NoteEntity).save({
          tenantId: identity.tenantId,
          ownerId: identity.ownerId,
          title,
        });
        await manager
          .getRepository(AuditEntity)
          .insert({ noteId: note.id, action: "create" });
        return { id: note.id, title: note.title };
      });
    } catch (error) {
      if (phase === "upstream" && signal.aborted) {
        this.cancelled++;
        throw new GatewayTimeoutException(
          "upstream cancelled before database work",
        );
      }
      throw error;
    } finally {
      this.active--;
    }
  }
}
@Controller()
class ApiController {
  constructor(
    private readonly preview: PreviewService,
    private readonly jobs: DurableJobs,
  ) {}
  @Post("notes/from-upstream")
  @UseGuards(IdentityGuard)
  async create(
    @Body() input: TitleInput,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const disconnected = new AbortController();
    const abort = () => {
      if (!res.writableEnded)
        disconnected.abort(new Error("CLIENT_DISCONNECTED"));
    };
    res.once("close", abort);
    req.once("aborted", abort);
    try {
      return await this.preview.create(
        req.identity,
        input.title,
        disconnected.signal,
      );
    } finally {
      res.removeListener("close", abort);
      req.removeListener("aborted", abort);
    }
  }
  @Post("jobs") @UseGuards(IdentityGuard) enqueue(
    @Req() req: AuthRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Body() input: TitleInput,
  ) {
    if (!key || !/^[a-zA-Z0-9_-]{1,64}$/.test(key))
      throw new BadRequestException("idempotency-key required");
    return this.jobs
      .enqueue(key, input.title, req.identity)
      .then((job) => ({
        id: job.id,
        status: job.status,
        resultId: job.resultId,
      }));
  }
  @Get("health") health() {
    return { ok: true };
  }
}
export async function createApp(options: Options) {
  const url = new URL(options.url);
  if (url.hostname !== "127.0.0.1")
    throw new Error("only owned loopback upstream accepted");
  if (
    !Number.isInteger(options.budgetMs) ||
    options.budgetMs < 1 ||
    options.budgetMs > 5000
  )
    throw new Error("invalid budget");
  @Module({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => ({
          type: "postgres",
          url: databaseUrl(),
          entities: [OwnerEntity, NoteEntity, AuditEntity],
          synchronize: false,
          retryAttempts: 1,
          extra: { max: 4, connectionTimeoutMillis: 1000 },
          invalidWhereValuesBehavior: { null: "throw", undefined: "throw" },
        }),
      }),
    ],
    providers: [
      IdentityGuard,
      DurableJobs,
      PreviewService,
      { provide: UPSTREAM, useValue: options },
    ],
    controllers: [ApiController],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, "127.0.0.1");
  return app;
}
