import "reflect-metadata";
import {
  ArgumentsHost,
  Body,
  CallHandler,
  CanActivate,
  Catch,
  Controller,
  ExecutionContext,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Injectable,
  Module,
  NestInterceptor,
  Post,
  Req,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { IsString, MaxLength, MinLength } from "class-validator";
import { Observable, catchError, finalize, tap, throwError } from "rxjs";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";

type TracedRequest = Request & { trace: string[]; requestId: string };
export class CreateNoteDto {
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
}
@Injectable()
export class NotesService {
  readonly notes: {
    id: string;
    tenant: string;
    owner: string;
    title: string;
  }[] = [];
  create(title: string) {
    const note = {
      id: randomUUID(),
      tenant: "tenant-a",
      owner: "alice",
      title,
    };
    this.notes.push(note);
    return note;
  }
}
@Injectable()
class DemoGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<TracedRequest>();
    req.trace.push("guard");
    if (req.headers.authorization !== "Bearer alice-demo")
      throw new ForbiddenException("demo identity required");
    return true;
  }
}
@Injectable()
class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<TracedRequest>();
    const res = http.getResponse<Response>();
    req.trace.push("interceptor:before");
    return next.handle().pipe(
      tap(() => {
        req.trace.push("interceptor:after");
        res.setHeader("x-trace", req.trace.join(","));
      }),
      catchError((error) => {
        req.trace.push("interceptor:error");
        return throwError(() => error);
      }),
      finalize(() => req.trace.push("interceptor:finalize")),
    );
  }
}
@Catch()
class JsonFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp(),
      req = http.getRequest<TracedRequest>(),
      res = http.getResponse<Response>();
    req.trace.push("filter");
    const status = error instanceof HttpException ? error.getStatus() : 500;
    res.status(status).json({
      status,
      requestId: req.requestId,
      trace: [...req.trace],
      error:
        status === 500
          ? "INTERNAL"
          : error instanceof HttpException
            ? error.getResponse()
            : "INTERNAL",
    });
  }
}
@Controller("notes")
class NotesController {
  constructor(private readonly notes: NotesService) {}
  @Post()
  create(@Body() dto: CreateNoteDto, @Req() req: TracedRequest) {
    req.trace.push("handler");
    if (dto.title === "crash")
      throw new Error("private detail must not escape");
    return this.notes.create(dto.title);
  }
}
@Module({
  controllers: [NotesController],
  providers: [NotesService, DemoGuard, TraceInterceptor],
})
class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use((req: TracedRequest, _res: Response, next: () => void) => {
    req.trace = ["middleware"];
    req.requestId = randomUUID();
    next();
  });
  app.useGlobalGuards(app.get(DemoGuard));
  app.useGlobalInterceptors(app.get(TraceInterceptor));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new JsonFilter());
  await app.listen(0, "127.0.0.1");
  return app;
}
