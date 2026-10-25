import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
const execute = promisify(execFile);
const bin = process.env.PG_BIN || "/Library/PostgreSQL/17/bin";
const port = "55482";
const limit = Number(process.env.NEST_PG_COMMAND_MS ?? "20000");
if (!Number.isInteger(limit) || limit < 100 || limit > 20000)
  throw new Error("invalid PG command budget");
const command = (name, args, timeout = limit) =>
  execute(join(bin, name), args, {
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, LC_ALL: "C", PGCONNECT_TIMEOUT: "2" },
  });
async function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: Number(port) });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
export async function withCluster(run) {
  if (await portOpen())
    throw new Error(
      "Refusing occupied port 55482; no existing cluster will be touched",
    );
  const folder = await mkdtemp(join(tmpdir(), "atlas-nest-pg-")),
    data = join(folder, "data"),
    socket = join(folder, "socket");
  await mkdir(socket, { mode: 0o700 });
  let initialized = false;
  const flags = [
    "-h",
    "127.0.0.1",
    "-p",
    port,
    "-U",
    "atlas",
    "-d",
    "postgres",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ];
  const cluster = {
    url: "postgres://atlas@127.0.0.1:55482/postgres",
    sql: async (sql) =>
      (await command("psql", [...flags, "-c", sql])).stdout.trim(),
    stop: async () => {
      if (!initialized) return;
      let running;
      try {
        await command("pg_ctl", ["-D", data, "status"]);
        running = true;
      } catch (error) {
        if (error.code === 3) running = false;
        else
          throw new Error(
            "Owned cluster status unknown; preserving " + folder,
            { cause: error },
          );
      }
      if (running)
        await command("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    },
    start: async () => {
      await command("pg_ctl", [
        "-D",
        data,
        "-l",
        join(folder, "server.log"),
        "-o",
        `-h 127.0.0.1 -p ${port} -k ${socket}`,
        "-w",
        "start",
      ]);
    },
  };
  try {
    await command("initdb", [
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
    initialized = true;
    await cluster.start();
    const version = await cluster.sql("SHOW server_version_num");
    if (version !== "170004")
      throw new Error("Requires PostgreSQL17.4, observed " + version);
    await command("psql", [
      ...flags,
      "-f",
      fileURLToPath(new URL("../schema.sql", import.meta.url)),
    ]);
    return await run(cluster);
  } catch (error) {
    try {
      console.error(
        (await readFile(join(folder, "server.log"), "utf8")).slice(-2000),
      );
    } catch {}
    throw error;
  } finally {
    try {
      await cluster.stop();
    } catch (error) {
      console.error("Cleanup uncertain; preserving " + folder);
      throw error;
    }
    await rm(folder, { recursive: true, force: true });
  }
}
