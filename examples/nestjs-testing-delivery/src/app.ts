import "reflect-metadata";
import {
  Controller,
  HttpCode,
  Get,
  Inject,
  Module,
  Query,
  Req,
  ServiceUnavailableException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { setTimeout as delay } from "node:timers/promises";
import type { Request, Response } from "express";
import { NoteEntity, OwnerEntity, AuditEntity } from "./model";
import { databaseUrl } from "./config";
import { Runtime, log, requestId, queryBudget } from "./runtime";
import { IdentityGuard, AuthRequest } from "./auth";
export const RUNTIME = Symbol("RUNTIME");
type Traced = AuthRequest & { requestId: string };
@Controller()
class DeliveryController {
  constructor(
    private readonly ds: DataSource,
    @Inject(RUNTIME) private readonly runtime: Runtime,
  ) {}
  @Get("health/live") live() {
    return { live: true };
  }
  @Get("health/ready") async ready() {
    if (this.runtime.draining)
      throw new ServiceUnavailableException("draining");
    try {
      await this.ds.query("SELECT 1");
      return { ready: true };
    } catch {
      throw new ServiceUnavailableException("database unavailable");
    }
  }
  @Post("work") @HttpCode(200) @UseGuards(IdentityGuard) async work(
    @Query("ms") raw: string,
    @Req() req: Traced,
  ) {
    const ms = Number(raw);
    if (!Number.isInteger(ms) || ms < 0 || ms > 1500)
      throw new ServiceUnavailableException("invalid work fixture");
    try {
      return await this.runtime.run(req.requestId, async (signal) => {
        await delay(ms, undefined, { signal });
        signal.throwIfAborted();
        const note = await this.ds.getRepository(NoteEntity).save({
          tenantId: req.identity.tenantId,
          ownerId: req.identity.ownerId,
          title: req.requestId,
        });
        return { id: note.id, title: note.title };
      });
    } catch (error) {
      if ((error as Error).name === "AbortError")
        throw new ServiceUnavailableException("shutdown budget exhausted");
      throw error;
    }
  }
}
export async function createApp() {
  const runtime = new Runtime();
  @Module({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => ({
          type: "postgres",
          url: databaseUrl(),
          entities: [NoteEntity, OwnerEntity, AuditEntity],
          synchronize: false,
          retryAttempts: 1,
          extra: {
            max: 4,
            connectionTimeoutMillis: 500,
            query_timeout: queryBudget(process.env.QUERY_TIMEOUT_MS),
          },
          invalidWhereValuesBehavior: { null: "throw", undefined: "throw" },
        }),
      }),
    ],
    providers: [IdentityGuard, { provide: RUNTIME, useValue: runtime }],
    controllers: [DeliveryController],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.use((req: Traced, res: Response, next: () => void) => {
    req.requestId = requestId(req.headers["x-request-id"]);
    res.setHeader("x-request-id", req.requestId);
    res.once("finish", () =>
      log({
        event: "http_finished",
        requestId: req.requestId,
        path: req.path,
        status: res.statusCode,
      }),
    );
    if (runtime.draining && !req.path.startsWith("/health/"))
      return res.status(503).json({ error: "DRAINING" });
    next();
  });
  await app.listen(0, "127.0.0.1");
  return { app, runtime };
}
