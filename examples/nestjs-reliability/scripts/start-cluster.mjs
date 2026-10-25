import { spawn } from "node:child_process";
import { withCluster } from "./cluster.mjs";
await withCluster(async (cluster) => {
  const child = spawn(process.execPath, ["dist/main.js"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: cluster.url },
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    if (code !== 0) throw new Error("app failed: " + code);
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
  }
});
