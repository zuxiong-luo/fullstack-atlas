import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "redis";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const running = (child) =>
  child && child.exitCode === null && child.signalCode === null;
async function exited(child, ms) {
  if (!running(child)) return;
  let timer, done;
  try {
    await new Promise((resolve, reject) => {
      done = resolve;
      child.once("exit", done);
      timer = setTimeout(
        () => reject(new Error("owned Redis did not exit")),
        ms,
      );
    });
  } finally {
    clearTimeout(timer);
    child.removeListener("exit", done);
  }
}
export async function withServices(run) {
  const root = await mkdtemp(join(tmpdir(), "atlas-flash-sale-"));
  const bin = process.env.PG_BIN || "/Library/PostgreSQL/17/bin";
  const data = join(root, "pg"),
    socket = join(root, "socket");
  await mkdir(socket, { mode: 0o700 });
  let pgStarted = false,
    child,
    client,
    redisSafe = true;
  const pg = (name, args) =>
    execFileSync(join(bin, name), args, { stdio: "pipe", timeout: 30000 });
  const redis = {
    async command(...args) {
      if (!client?.isOpen) throw new Error("REDIS_UNAVAILABLE");
      let timer;
      try {
        return await Promise.race([
          client.sendCommand(args.map(String)),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              if (client.isOpen) client.disconnect();
              reject(new Error("REDIS_BUDGET_EXCEEDED"));
            }, 2000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    async start() {
      if (running(child)) throw new Error("ALREADY_RUNNING");
      let logs = "",
        failure;
      child = spawn(
        process.env.REDIS_SERVER || "redis-server",
        [
          "--bind",
          "127.0.0.1",
          "--port",
          "56390",
          "--protected-mode",
          "yes",
          "--dir",
          root,
          "--save",
          "",
          "--appendonly",
          "yes",
          "--appendfsync",
          "always",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      redisSafe = false;
      child.once("error", (error) => {
        failure = error;
        redisSafe = true;
      });
      child.stdout.on("data", (b) => {
        logs += b;
      });
      child.stderr.on("data", (b) => {
        logs += b;
      });
      const end = Date.now() + 5000;
      while (!logs.includes("Ready to accept connections")) {
        if (failure) throw failure;
        if (!running(child) || Date.now() > end)
          throw new Error("Private Redis startup failed: " + logs);
        await pause(10);
      }
      client = createClient({
        url: "redis://127.0.0.1:56390",
        disableOfflineQueue: true,
        socket: { reconnectStrategy: false, connectTimeout: 1500 },
      });
      client.on("error", () => {});
      await client.connect();
      const info = await redis.command("INFO", "server");
      if (!info.includes("redis_version:7.0.4\r\n"))
        throw new Error("Example verified with Redis 7.0.4");
    },
    async stop() {
      if (client?.isOpen) await client.disconnect();
      if (running(child)) {
        child.kill("SIGTERM");
        try {
          await exited(child, 5000);
        } catch {
          child.kill("SIGKILL");
          await exited(child, 2000);
        }
      }
      redisSafe = !running(child);
    },
  };
  try {
    const version = pg("postgres", ["--version"]).toString();
    if (!version.includes("17.4"))
      throw new Error("Example verified with PostgreSQL17.4");
    pg("initdb", [
      "-D",
      data,
      "-U",
      "atlas",
      "-A",
      "trust",
      "--no-locale",
      "-E",
      "UTF8",
    ]);
    pg("pg_ctl", [
      "-D",
      data,
      "-l",
      join(root, "pg.log"),
      "-o",
      `-h '' -p 55486 -k ${socket}`,
      "-w",
      "start",
    ]);
    pgStarted = true;
    await redis.start();
    await run({
      redis,
      config: {
        host: socket,
        port: 55486,
        user: "atlas",
        database: "postgres",
        max: 4,
        connectionTimeoutMillis: 1500,
        statement_timeout: 4000,
      },
    });
  } catch (error) {
    const log = await readFile(join(root, "pg.log"), "utf8").catch(() => "");
    if (log) error.message += "\n" + log.slice(-1200);
    throw error;
  } finally {
    let pgSafe = !pgStarted && !existsSync(join(data, "postmaster.pid"));
    try {
      await redis.stop();
    } finally {
      if (pgStarted || existsSync(join(data, "postmaster.pid"))) {
        const status = spawnSync(join(bin, "pg_ctl"), ["-D", data, "status"], {
          timeout: 5000,
        });
        if (status.status === 0) {
          const stop = spawnSync(
            join(bin, "pg_ctl"),
            ["-D", data, "-m", "fast", "-w", "stop"],
            { timeout: 30000 },
          );
          const after = spawnSync(join(bin, "pg_ctl"), ["-D", data, "status"], {
            timeout: 5000,
          });
          pgSafe = stop.status === 0 && after.status === 3;
        } else pgSafe = status.status === 3;
      }
      if (pgSafe && redisSafe) await rm(root, { recursive: true, force: true });
      else
        throw new Error(
          "Cleanup unconfirmed; retained private directory: " + root,
        );
    }
  }
}
