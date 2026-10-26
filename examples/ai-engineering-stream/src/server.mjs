import http from "node:http";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const terminal = new Set(["completed", "cancelled", "failed"]);
export function makeRuntime({
  intervalMs = 400,
  maxActive = 4,
  maxRuns = 16,
  ttlMs = 600000,
} = {}) {
  const runs = new Map();
  function append(run, type, data) {
    if (terminal.has(run.status)) return;
    run.events.push({ id: run.events.length + 1, type, data });
    if (terminal.has(type)) run.status = type;
  }
  function create(question) {
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 2000
    )
      throw new Error("INVALID_QUESTION");
    for (const [id, run] of runs)
      if (terminal.has(run.status) && Date.now() - run.createdAt > ttlMs)
        runs.delete(id);
    if (
      [...runs.values()].filter((r) => !terminal.has(r.status)).length >=
        maxActive ||
      runs.size >= maxRuns
    )
      throw new Error("CAPACITY");
    const run = {
      id: randomUUID(),
      createdAt: Date.now(),
      status: "running",
      events: [],
      controller: new AbortController(),
      subscribers: 0,
    };
    runs.set(run.id, run);
    append(run, "started", { mode: "deterministic-demo-not-model" });
    run.finished = (async () => {
      try {
        // These are text chunks, not tokenizer tokens and not paid-model measurements.
        for (const text of [
          "权限申请需要",
          "先由主管确认角色，",
          "再向管理员提交工单。",
          "审批通过后，",
          "管理员才可以调整权限。",
        ]) {
          await delay(intervalMs, undefined, { signal: run.controller.signal });
          append(run, "delta", { text });
        }
        append(run, "completed", {
          answer:
            "权限申请需要先由主管确认角色，再向管理员提交工单。审批通过后，管理员才可以调整权限。",
        });
      } catch (error) {
        append(run, run.controller.signal.aborted ? "cancelled" : "failed", {
          code: run.controller.signal.aborted
            ? "USER_CANCELLED"
            : "GENERATION_ERROR",
        });
      }
    })();
    return run;
  }
  function cancel(id) {
    const run = runs.get(id);
    if (!run) throw new Error("NOT_FOUND");
    if (!terminal.has(run.status)) run.controller.abort();
    return run;
  }
  return {
    runs,
    create,
    cancel,
    async close() {
      for (const run of runs.values()) run.controller.abort();
      await Promise.all([...runs.values()].map((r) => r.finished));
    },
  };
}
export function frame(event) {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
async function jsonBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8192) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createService(options = {}) {
  const runtime = makeRuntime(options);
  const send = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`)
        return send(res, 403, { error: "ORIGIN_DENIED" });
      if (req.method === "POST" && url.pathname === "/runs") {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return send(res, 415, { error: "JSON_REQUIRED" });
        const { question } = await jsonBody(req);
        const run = runtime.create(question);
        return send(res, 201, {
          id: run.id,
          mode: "deterministic-demo-not-model",
        });
      }
      const match = url.pathname.match(
        /^\/runs\/([a-f0-9-]{36})\/(events|cancel)$/,
      );
      if (match) {
        const run = runtime.runs.get(match[1]);
        if (!run) return send(res, 404, { error: "RUN_UNKNOWN_OR_EXPIRED" });
        if (req.method === "POST" && match[2] === "cancel") {
          runtime.cancel(run.id);
          return send(res, 202, { status: run.status });
        }
        if (req.method === "GET" && match[2] === "events") {
          const cursorText =
            req.headers["last-event-id"] ??
            url.searchParams.get("after") ??
            "0";
          if (!/^\d{1,8}$/.test(cursorText))
            return send(res, 400, { error: "INVALID_CURSOR" });
          let cursor = Number(cursorText);
          if (cursor > run.events.length)
            return send(res, 409, { error: "CURSOR_AHEAD" });
          if (run.subscribers >= 4)
            return send(res, 429, { error: "SUBSCRIBER_CAPACITY" });
          const connection = new AbortController();
          res.on("close", () => connection.abort());
          run.subscribers++;
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          });
          res.flushHeaders();
          const deadline = Date.now() + 25000;
          let heartbeat = Date.now();
          try {
            while (!connection.signal.aborted && Date.now() < deadline) {
              for (const event of run.events.slice(cursor)) {
                if (!res.write(frame(event)))
                  await once(res, "drain", { signal: connection.signal });
                cursor = event.id;
              }
              if (terminal.has(run.status) && cursor === run.events.length)
                break;
              if (Date.now() - heartbeat >= 10000) {
                res.write(": heartbeat\n\n");
                heartbeat = Date.now();
              }
              await delay(20, undefined, { signal: connection.signal });
            }
          } catch (error) {
            if (!connection.signal.aborted) throw error;
          } finally {
            run.subscribers--;
            res.end();
          }
          return;
        }
      }
      if (req.method === "GET" && ["/", "/client.js"].includes(url.pathname)) {
        const file = url.pathname === "/" ? "index.html" : "client.js";
        const body = await readFile(
          new URL("../public-app/" + file, import.meta.url),
        );
        res.writeHead(200, {
          "Content-Type": file.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : "text/html; charset=utf-8",
        });
        return res.end(body);
      }
      send(res, 404, { error: "NOT_FOUND" });
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const code = error.message;
      send(
        res,
        code === "CAPACITY" ? 429 : code === "BODY_TOO_LARGE" ? 413 : 400,
        { error: code === "CAPACITY" ? code : "INVALID_REQUEST" },
      );
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    server,
    runtime,
    async close() {
      await runtime.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const service = createService();
  service.server.listen(4190, "127.0.0.1", () =>
    console.log("http://127.0.0.1:4190 — deterministic demo"),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => service.close().then(() => process.exit(0)));
}
