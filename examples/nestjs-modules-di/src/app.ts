import "reflect-metadata";
import {
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  Scope,
  DynamicModule,
} from "@nestjs/common";
import { NestFactory, REQUEST } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
export const CONFIG = Symbol("CONFIG");
export const CLOCK = Symbol("CLOCK");
export const AUDIT = Symbol("AUDIT");
export const events: string[] = [];
@Injectable()
export class AuditSink implements OnModuleInit, OnApplicationShutdown {
  readonly id = randomUUID();
  opened = false;
  closed = false;
  async onModuleInit() {
    await new Promise((resolve) => setImmediate(resolve));
    this.opened = true;
    events.push("audit:opened");
  }
  onApplicationShutdown() {
    this.closed = true;
    events.push("audit:closed");
  }
}
@Module({})
export class InfrastructureModule {
  static forRoot(tenant: string): DynamicModule {
    return {
      module: InfrastructureModule,
      providers: [
        {
          provide: CONFIG,
          useFactory: async () => {
            await new Promise((resolve) => setImmediate(resolve));
            events.push("config:ready");
            return Object.freeze({ tenant });
          },
        },
        { provide: CLOCK, useValue: { now: () => "2026-10-25T00:00:00Z" } },
        { provide: AUDIT, useClass: AuditSink },
      ],
      exports: [CONFIG, CLOCK, AUDIT],
    };
  }
}
@Injectable({ scope: Scope.REQUEST })
class RequestIdentity {
  readonly id = randomUUID();
  constructor(@Inject(REQUEST) readonly request: Request) {}
}
@Injectable({ scope: Scope.TRANSIENT })
class Scratch {
  readonly id = randomUUID();
}
@Injectable()
class ConsumerA {
  constructor(readonly scratch: Scratch) {}
}
@Injectable()
class ConsumerB {
  constructor(readonly scratch: Scratch) {}
}
@Controller("notes")
class NotesController {
  constructor(
    @Inject(CONFIG) private readonly config: { tenant: string },
    @Inject(CLOCK) private readonly clock: { now: () => string },
    @Inject(AUDIT) private readonly audit: AuditSink,
    private readonly request: RequestIdentity,
    private readonly a: ConsumerA,
    private readonly b: ConsumerB,
  ) {}
  @Get("identities")
  identities() {
    return {
      tenant: this.config.tenant,
      owner: "alice",
      now: this.clock.now(),
      audit: this.audit.id,
      opened: this.audit.opened,
      request: this.request.id,
      requestHeader: this.request.request.headers["x-client-id"] ?? null,
      a: this.a.scratch.id,
      b: this.b.scratch.id,
    };
  }
}
@Module({
  imports: [InfrastructureModule.forRoot("tenant-a")],
  controllers: [NotesController],
  providers: [RequestIdentity, Scratch, ConsumerA, ConsumerB],
})
export class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  return app;
}
