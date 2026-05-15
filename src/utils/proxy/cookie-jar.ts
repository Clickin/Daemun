import { Cookie, CookieJar } from "tough-cookie";

const cookieJar = new CookieJar();

interface CookieRequestParams {
  cookieHeader?: string;
  headers?: Record<string, string | number>;
}

type ResponseHeaders = Headers | Record<string, string | string[] | undefined>;

export function setCookieHeader(url: URL | string, params: CookieRequestParams, { overwrite = false } = {}) {
  // add cookie header, if we have one in the jar
  const existingCookie = cookieJar.getCookieStringSync(url.toString());
  if (existingCookie) {
    params.headers = params.headers ?? {};
    const cookieHeader = params.cookieHeader ?? "Cookie";
    if (overwrite || !params.headers[cookieHeader]) {
      params.headers[cookieHeader] = existingCookie;
    }
  }
}

export function addCookieToJar(url: URL | string, headers: ResponseHeaders) {
  let cookieHeader = headers["set-cookie"];
  if (headers instanceof Headers) {
    cookieHeader = headers.get("set-cookie");
  }

  if (!cookieHeader || cookieHeader.length === 0) return;

  let cookies = null;
  if (cookieHeader instanceof Array) {
    cookies = cookieHeader.flatMap((c) => {
      const cookie = Cookie.parse(c);
      if (!cookie) return [];
      cookie.setMaxAge(60 * 60);
      return [cookie];
    });
  } else {
    const cookie = Cookie.parse(cookieHeader);
    if (!cookie) return;
    cookie.setMaxAge(60 * 60);
    cookies = [cookie];
  }

  for (let i = 0; i < cookies.length; i += 1) {
    cookieJar.setCookieSync(cookies[i], url.toString(), { ignoreError: true });
  }
}
