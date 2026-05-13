import { serve } from "@hono/node-server";
import { createServer as createViteServer } from "vite";

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const vitePort = Number(process.env.VITE_PORT || 5173);
const viteHost = process.env.VITE_HOST || "0.0.0.0";
const viteOriginHost = viteHost === "0.0.0.0" ? "localhost" : viteHost;

process.env.VITE_DEV_SERVER_ORIGIN ||= `http://${viteOriginHost}:${vitePort}`;

const vite = await createViteServer({
  appType: "custom",
  server: {
    host: viteHost,
    port: vitePort,
    strictPort: true,
  },
});

await vite.listen(vitePort, viteHost);

const server = serve(
  {
    async fetch(request, env, executionContext) {
      const { default: app } = await vite.ssrLoadModule("/src/server/app.js");
      return app.fetch(request, env, executionContext);
    },
    hostname,
    port,
  },
  () => {
    console.log(`Hono dev server listening on http://${hostname}:${port}`);
    console.log(`Vite dev assets served from ${process.env.VITE_DEV_SERVER_ORIGIN}`);
  },
);

let shuttingDown = false;

async function stop() {
  if (shuttingDown) return;
  shuttingDown = true;

  await vite.close();
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
