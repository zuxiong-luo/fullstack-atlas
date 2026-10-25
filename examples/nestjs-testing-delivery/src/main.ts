import { createApp } from "./app";
import { drainBudget, log } from "./runtime";
async function main() {
  const budget = drainBudget(process.env.DRAIN_MS);
  const { app, runtime } = await createApp();
  let closing = false;
  const close = async (signal: string) => {
    if (closing) return;
    closing = true;
    runtime.draining = true;
    log({
      event: "draining",
      signal,
      active: runtime.active.size,
      budgetMs: budget,
    });
    const idleSweep = setInterval(
      () => app.getHttpServer().closeIdleConnections(),
      20,
    );
    const abortTimer = setTimeout(() => {
      log({ event: "budget_exhausted", active: runtime.active.size });
      runtime.abort();
    }, budget);
    const hardTimer = setTimeout(() => {
      log({ event: "shutdown_forced", active: runtime.active.size });
      app.getHttpServer().closeAllConnections();
      process.exit(1);
    }, budget + 1000);
    try {
      await app.close();
      log({ event: "closed", active: runtime.active.size });
    } finally {
      clearInterval(idleSweep);
      clearTimeout(abortTimer);
      clearTimeout(hardTimer);
    }
  };
  process.once("SIGTERM", () => void close("SIGTERM"));
  process.once("SIGINT", () => void close("SIGINT"));
  log({ event: "listening", url: await app.getUrl() });
}
void main().catch(() => {
  log({ event: "startup_failed", code: "CONFIG_OR_DEPENDENCY_INVALID" });
  process.exitCode = 1;
});
