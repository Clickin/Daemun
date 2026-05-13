import { serve } from "@hono/node-server";

import app from "./app.js";

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || "::";

export const server = serve({
  fetch: app.fetch,
  hostname,
  port,
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
