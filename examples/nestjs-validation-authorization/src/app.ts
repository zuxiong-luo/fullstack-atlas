import "reflect-metadata";
import {
  ArgumentsHost,
  Body,
  CanActivate,
  Catch,
  Controller,
  ExecutionContext,
  ExceptionFilter,
  ForbiddenException,
  Get,
  HttpException,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  ValidationPipe,
  ConflictException,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { Request } from "express";
import { AuditEntity, Note, NoteEntity, OwnerEntity } from "./model";
import { databaseUrl } from "./config";
export type Identity = {
  tenantId: string;
  ownerId: string;
  role: "writer" | "reader";
};
type AuthRequest = Request & { identity: Identity };
const identities: Record<string, Identity> = {
  "alice-demo": { tenantId: "tenant-a", ownerId: "alice", role: "writer" },
  "alice-readonly-demo": {
    tenantId: "tenant-a",
    ownerId: "alice",
    role: "reader",
  },
  "bob-demo": { tenantId: "tenant-b", ownerId: "bob", role: "writer" },
  "bob-a-demo": { tenantId: "tenant-a", ownerId: "bob", role: "writer" },
};
@Injectable()
class IdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const auth = req.headers.authorization;
    const identity = auth?.startsWith("Bearer ")
      ? Object.hasOwn(identities, auth.slice(7))
        ? identities[auth.slice(7)]
        : undefined
      : undefined;
    if (!identity) throw new UnauthorizedException("identity required");
    req.identity = identity;
    if (req.method !== "GET" && identity.role !== "writer")
      throw new ForbiddenException("write permission required");
    return true;
  }
}
export class CreateNoteDto {
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) body?: string | null;
}
export class UpdateNoteDto extends CreateNoteDto {
  @IsInt() @Min(1) @Max(2147483646) expectedVersion!: number;
}
export function publicNote(note: Note) {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    amount: note.amount,
    version: note.version,
    createdAt: note.createdAt.toISOString(),
  };
}
@Injectable()
export class NotesService {
  operations = 0;
  constructor(private readonly source: DataSource) {}
  async read(identity: Identity, id: number) {
    this.operations++;
    const note = await this.source.getRepository(NoteEntity).findOneBy({
      id,
      tenantId: identity.tenantId,
      ownerId: identity.ownerId,
    });
    if (!note) throw new NotFoundException();
    return publicNote(note);
  }
  async create(identity: Identity, input: CreateNoteDto) {
    this.operations++;
    return this.source.transaction(async (manager) => {
      const note = await manager.getRepository(NoteEntity).save({
        tenantId: identity.tenantId,
        ownerId: identity.ownerId,
        title: input.title,
        body: input.body ?? null,
      });
      await manager
        .getRepository(AuditEntity)
        .insert({ noteId: note.id, action: "create" });
      return publicNote(note);
    });
  }
  async update(identity: Identity, id: number, input: UpdateNoteDto) {
    this.operations++;
    return this.source.transaction(async (manager) => {
      const notes = manager.getRepository(NoteEntity);
      const visible = await notes.findOneBy({
        id,
        tenantId: identity.tenantId,
        ownerId: identity.ownerId,
      });
      if (!visible) throw new NotFoundException();
      const result = await notes.update(
        {
          id,
          tenantId: identity.tenantId,
          ownerId: identity.ownerId,
          version: input.expectedVersion,
        },
        {
          title: input.title,
          ...(input.body === undefined ? {} : { body: input.body }),
          version: input.expectedVersion + 1,
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("version conflict");
      await manager
        .getRepository(AuditEntity)
        .insert({ noteId: id, action: "update" });
      return publicNote(
        await notes.findOneByOrFail({
          id,
          tenantId: identity.tenantId,
          ownerId: identity.ownerId,
        }),
      );
    });
  }
}
@Catch()
class ApiFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const dbCode = (error as { driverError?: { code?: string } })?.driverError
      ?.code;
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : dbCode === "23505"
          ? 409
          : 500;
    response.status(status).json({
      status,
      error:
        status === 500
          ? "INTERNAL"
          : status === 409
            ? "CONFLICT"
            : error instanceof HttpException
              ? error.getResponse()
              : "INTERNAL",
    });
  }
}
@Controller("notes")
class NotesController {
  constructor(private readonly notes: NotesService) {}
  @Get(":id") read(
    @Req() req: AuthRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.notes.read(req.identity, id);
  }
  @Post() create(@Req() req: AuthRequest, @Body() input: CreateNoteDto) {
    return this.notes.create(req.identity, input);
  }
  @Patch(":id") update(
    @Req() req: AuthRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: UpdateNoteDto,
  ) {
    return this.notes.update(req.identity, id, input);
  }
}
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
  controllers: [NotesController],
  providers: [NotesService, { provide: APP_GUARD, useClass: IdentityGuard }],
})
class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new ApiFilter());
  await app.listen(0, "127.0.0.1");
  return app;
}
