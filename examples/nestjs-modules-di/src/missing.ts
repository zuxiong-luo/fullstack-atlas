import "reflect-metadata";
import { Inject, Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
const PRIVATE = Symbol("PRIVATE");
@Module({ providers: [{ provide: PRIVATE, useValue: { tenant: "tenant-a" } }] })
class HiddenModule {}
@Injectable()
class NeedsPrivate {
  constructor(@Inject(PRIVATE) readonly config: unknown) {}
}
@Module({ imports: [HiddenModule], providers: [NeedsPrivate] })
class BrokenModule {}
export async function missingExport() {
  return Test.createTestingModule({ imports: [BrokenModule] }).compile();
}
