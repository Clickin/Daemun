function collectQuery(url) {
  const query = {};

  for (const [key, value] of new URL(url).searchParams.entries()) {
    if (query[key] === undefined) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }

  return query;
}

function collectHeaders(headers) {
  return Object.fromEntries(Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]));
}

async function readBody(c) {
  if (["GET", "HEAD"].includes(c.req.method)) return undefined;

  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await c.req.json();
    } catch {
      return undefined;
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return c.req.parseBody();
  }

  const text = await c.req.text();
  return text.length ? text : undefined;
}

function createApiResponse() {
  const headers = new Headers();

  const res = {
    body: undefined,
    finished: false,
    headers,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        value.forEach((entry) => headers.append(name, String(entry)));
      } else {
        headers.set(name, String(value));
      }
      return this;
    },
    getHeader(name) {
      return headers.get(name);
    },
    json(payload) {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }
      this.body = payload;
      this.finished = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    end(payload = "") {
      this.body = payload;
      this.finished = true;
      return this;
    },
    async revalidate() {
      return true;
    },
  };

  return res;
}

function toResponse(res) {
  const init = {
    headers: res.headers,
    status: res.statusCode || 200,
  };

  if (res.body === undefined) {
    return new Response(null, init);
  }

  if (
    typeof res.body === "string" ||
    res.body instanceof ArrayBuffer ||
    ArrayBuffer.isView(res.body) ||
    res.body instanceof Blob
  ) {
    return new Response(res.body, init);
  }

  if (!res.headers.has("content-type")) {
    res.headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(res.body), init);
}

export function splitCatchAll(value) {
  if (!value) return [];
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

export function honoApiHandler(handler, getRouteQuery = () => ({})) {
  return async (c) => {
    const req = {
      body: await readBody(c),
      headers: collectHeaders(c.req.raw.headers),
      method: c.req.method,
      query: {
        ...collectQuery(c.req.url),
        ...getRouteQuery(c),
      },
      url: new URL(c.req.url).pathname + new URL(c.req.url).search,
    };
    const res = createApiResponse();

    await handler(req, res);

    return toResponse(res);
  };
}

export { createApiResponse };
