import "reflect-metadata";
import {
  Body,
  Controller,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { AuditEntity, Note, NoteEntity, OwnerEntity } from "./model";
import { databaseUrl } from "./config";
export class NoteInput {
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @IsOptional() @IsBoolean() failAudit?: boolean;
}
@Injectable()
export class NotesService {
  constructor(
    private readonly source: DataSource,
    @InjectRepository(NoteEntity) readonly readRepository: Repository<Note>,
  ) {}
  async write(input: NoteInput, id?: number) {
    return this.source.transaction(async (manager) => {
      const notes = manager.getRepository(NoteEntity);
      let note: Note;
      if (id === undefined) {
        note = await notes.save(
          notes.create({
            tenantId: "tenant-a",
            ownerId: "alice",
            title: input.title,
          }),
        );
      } else {
        const current = await notes.findOneBy({
          id,
          tenantId: "tenant-a",
          ownerId: "alice",
        });
        if (!current) throw new NotFoundException();
        await notes.update(
          { id, tenantId: "tenant-a", ownerId: "alice" },
          { title: input.title, version: current.version + 1 },
        );
        note = await notes.findOneByOrFail({
          id,
          tenantId: "tenant-a",
          ownerId: "alice",
        });
      }
      await manager.getRepository(AuditEntity).insert({
        noteId: note.id,
        action: input.failAudit
          ? "BROKEN"
          : id === undefined
            ? "create"
            : "update",
      });
      return note;
    });
  }
}
@Controller("notes")
class NotesController {
  constructor(private readonly notes: NotesService) {}
  @Post() create(@Body() input: NoteInput) {
    return this.notes.write(input);
  }
  @Patch(":id") update(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: NoteInput,
  ) {
    return this.notes.write(input, id);
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
    TypeOrmModule.forFeature([NoteEntity]),
  ],
  providers: [NotesService],
  controllers: [NotesController],
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
    }),
  );
  await app.listen(0, "127.0.0.1");
  return app;
}
