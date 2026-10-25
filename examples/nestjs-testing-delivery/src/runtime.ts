import { randomUUID } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
export function log(event: Record<string, unknown>) {
  console.log(JSON.stringify(event));
}
export class Runtime {
  draining = false;
  readonly active = new Set<AbortController>();
  async run<T>(requestId: string, work: (signal: AbortSignal) => Promise<T>) {
    if (this.draining) throw new ServiceUnavailableException("draining");
    const controller = new AbortController();
    this.active.add(controller);
    log({ event: "work_started", requestId, active: this.active.size });
    try {
      return await work(controller.signal);
    } finally {
      this.active.delete(controller);
      log({ event: "work_finished", requestId, active: this.active.size });
    }
  }
  abort() {
    for (const controller of this.active)
      controller.abort(new Error("SHUTDOWN_BUDGET"));
  }
}
export function requestId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value)
    ? value
    : randomUUID();
}
export function drainBudget(value: string | undefined) {
  const n = Number(value ?? "150");
  if (!Number.isInteger(n) || n < 20 || n > 2000)
    throw new Error("INVALID_DRAIN_MS");
  return n;
}

export function queryBudget(value: string | undefined) {
  const n = Number(value ?? "500");
  if (!Number.isInteger(n) || n < 100 || n > 5000)
    throw new Error("INVALID_QUERY_MS");
  return n;
}
