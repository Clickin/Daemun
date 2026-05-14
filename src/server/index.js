import { createAdaptorServer, serve } from "@hono/node-server";
import fs from "node:fs/promises";

import { createApp } from "./app.js";
import { getListenOptions } from "./listen-options.js";
import { createStaticHomeCache, setStaticHomeCache } from "./static-home.js";

const { hostname, port, socketPath } = getListenOptions();

process.env.HOSTNAME = hostname;
process.env.PORT = String(port);

const staticHome = createStaticHomeCache();

setStaticHomeCache(staticHome);
await staticHome.start();

const app = createApp({ staticHome });

async function listen() {
  if (!socketPath) {
    return serve({
      fetch: app.fetch,
      hostname,
      port,
    });
  }

  await fs.rm(socketPath, { force: true });

  const socketServer = createAdaptorServer({ fetch: app.fetch, hostname });
  await new Promise((resolve, reject) => {
    socketServer.once("error", reject);
    socketServer.listen(socketPath, () => {
      socketServer.off("error", reject);
      resolve();
    });
  });
  await fs.chmod(socketPath, 0o666);
  return socketServer;
}

export const server = await listen();

process.on("SIGINT", () => {
  staticHome.close();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  staticHome.close();
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
