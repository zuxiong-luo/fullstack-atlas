import { createServer } from "node:http";
import { createApp } from "./app";
const upstream = createServer((_req, res) => {
  const timer = setTimeout(() => res.end("upstream note"), 200);
  res.once("close", () => clearTimeout(timer));
});
upstream.listen(0, "127.0.0.1", () => {
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("address");
  void createApp({ url: `http://127.0.0.1:${address.port}`, budgetMs: 500 })
    .then(async (app) => {
      console.log(JSON.stringify({ url: await app.getUrl() }));
      const stop = async () => {
        await app.close();
        upstream.close();
      };
      process.once("SIGTERM", () => void stop());
      process.once("SIGINT", () => void stop());
    })
    .catch((error) => {
      console.error(error);
      upstream.close();
      process.exitCode = 1;
    });
});
