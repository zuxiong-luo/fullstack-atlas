import { createApp } from "./app";
void createApp()
  .then(async (app) => {
    console.log(JSON.stringify({ url: await app.getUrl() }));
    process.once("SIGTERM", () => void app.close());
    process.once("SIGINT", () => void app.close());
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
