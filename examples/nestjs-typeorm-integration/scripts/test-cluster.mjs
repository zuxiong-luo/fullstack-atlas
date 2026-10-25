import { spawn } from "node:child_process";
import { withCluster } from "./cluster.mjs";
await withCluster(async (cluster) => {
  const child = spawn(process.execPath, ["--test", "test.mjs"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: cluster.url },
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), 90000);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  clearTimeout(timer);
  if (code !== 0) throw new Error("test child failed: " + code);
});
