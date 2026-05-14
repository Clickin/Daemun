export function serializePage(page) {
  return JSON.stringify(page).replaceAll("/", "\\/");
}

function defaultRootView(page) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`;
}

export function inertia(options = {}) {
  const version = options.version ?? null;
  const rootView = options.rootView ?? defaultRootView;

  return async function inertiaMiddleware(c, next) {
    if (c.req.header("X-Inertia") && c.req.method === "GET") {
      if ((c.req.header("X-Inertia-Version") ?? "") !== (version ?? "")) {
        c.header("X-Inertia-Location", c.req.url);
        return c.body(null, 409);
      }
    }

    c.setRenderer((component, props = {}) => {
      const url = new URL(c.req.url);
      const page = {
        component,
        props,
        url: url.pathname + url.search,
        version,
      };

      c.header("Vary", "Accept, X-Inertia");
      if (c.req.header("X-Inertia")) {
        c.header("X-Inertia", "true");
        return c.json(page);
      }

      if (c.req.header("Accept")?.includes("application/json")) {
        return c.json(props);
      }

      const rendered = rootView(page, c);
      if (rendered instanceof Promise) {
        return rendered.then((html) => c.html(html));
      }
      return c.html(rendered);
    });

    return next();
  };
}
