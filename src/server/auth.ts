import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import * as oidc from "openid-client";

const sessionCookie = "daemun_session";
const stateCookie = "daemun_oidc";
const maxAge = 60 * 60 * 24 * 7;

type Session = { exp: number };
type OidcState = Session & { state: string; nonce: string; verifier: string; callbackUrl: string };

function secret() {
  return process.env.HOMEPAGE_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
}

function oidcConfig() {
  const issuer = process.env.HOMEPAGE_OIDC_ISSUER?.replace(/\/+$/, "");
  const clientId = process.env.HOMEPAGE_OIDC_CLIENT_ID;
  const clientSecret = process.env.HOMEPAGE_OIDC_CLIENT_SECRET;
  const configured = [issuer, clientId, clientSecret].filter(Boolean).length;
  if (configured && configured !== 3) throw new Error("OIDC auth is enabled but required settings are missing.");
  return issuer && clientId && clientSecret ? { issuer, clientId, clientSecret } : undefined;
}

function enabled() {
  return Boolean(process.env.HOMEPAGE_AUTH_ENABLED);
}

function assertConfiguration() {
  if (!enabled()) return;
  const oidc = oidcConfig();
  if (oidc) {
    if (!secret() || !process.env.HOMEPAGE_EXTERNAL_URL) throw new Error("OIDC auth is enabled but required settings are missing.");
  } else if (!process.env.HOMEPAGE_AUTH_PASSWORD || !secret()) {
    throw new Error("Password auth is enabled but required settings are missing.");
  }
}

function encode(value: Session | OidcState) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}

function decode<T extends Session>(value?: string): T | undefined {
  if (!value || !secret()) return undefined;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return undefined;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
    return parsed.exp > Date.now() / 1000 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function cookieOptions(maxAgeSeconds = maxAge) {
  return { httpOnly: true, path: "/", sameSite: "Lax" as const, secure: process.env.HOMEPAGE_EXTERNAL_URL?.startsWith("https://"), maxAge: maxAgeSeconds };
}

function callbackUrl(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function redirectToSignIn(c: Context) {
  const request = new URL(c.req.url);
  return c.redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`${request.pathname}${request.search}`)}`);
}

function externalUrl() {
  return process.env.HOMEPAGE_EXTERNAL_URL?.replace(/\/$/, "");
}

export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // The MCP API handler authorizes both bearer tokens and Homepage sessions.
    if (!enabled() || c.req.path === "/api/healthcheck" || c.req.path === "/api/mcp") return next();
    assertConfiguration();
    return decode(getCookie(c, sessionCookie)) ? next() : redirectToSignIn(c);
  };
}

export function hasValidSession(c: Context) {
  return enabled() && Boolean(decode(getCookie(c, sessionCookie)));
}

export async function signIn(c: Context) {
  assertConfiguration();
  const destination = callbackUrl(c.req.query("callbackUrl"));
  const config = oidcConfig();
  if (!config) return c.html(`<!doctype html><title>Sign in</title><form method="post"><label>Password <input name="password" type="password" required autofocus></label><button>Sign in</button></form>`);

  const verifier = oidc.randomPKCECodeVerifier();
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const client = await oidc.discovery(new URL(config.issuer), config.clientId, undefined, oidc.ClientSecretBasic(config.clientSecret));
  const url = oidc.buildAuthorizationUrl(client, { redirect_uri: `${externalUrl()}/api/auth/callback`, scope: process.env.HOMEPAGE_OIDC_SCOPE || "openid email profile", state, nonce, code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256" });
  setCookie(c, stateCookie, encode<OidcState>({ exp: Date.now() / 1000 + 600, state, nonce, verifier, callbackUrl: destination }), cookieOptions(600));
  return c.redirect(url.toString());
}

export async function passwordSignIn(c: Context) {
  assertConfiguration();
  if (oidcConfig()) return c.text("Method Not Allowed", 405);
  const body = await c.req.parseBody();
  const password = typeof body.password === "string" ? body.password : "";
  // ponytail: digest computed per call (not module load) so env changes are honored in tests; sha256 digests are fixed length so timingSafeEqual never throws
  const expected = process.env.HOMEPAGE_AUTH_PASSWORD || "";
  if (!expected) return c.redirect("/auth/signin?error=CredentialsSignin");
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const providedDigest = createHash("sha256").update(password, "utf8").digest();
  if (!timingSafeEqual(providedDigest, expectedDigest)) return c.redirect("/auth/signin?error=CredentialsSignin");
  setCookie(c, sessionCookie, encode({ exp: Date.now() / 1000 + maxAge }), cookieOptions());
  return c.redirect(callbackUrl(c.req.query("callbackUrl")));
}

export async function oidcCallback(c: Context) {
  assertConfiguration();
  const state = decode<OidcState>(getCookie(c, stateCookie));
  const config = oidcConfig();
  if (!state || !config) return c.redirect("/auth/signin?error=Callback");
  try {
    const client = await oidc.discovery(new URL(config.issuer), config.clientId, undefined, oidc.ClientSecretBasic(config.clientSecret));
    await oidc.authorizationCodeGrant(client, c.req.raw, { expectedState: state.state, expectedNonce: state.nonce, pkceCodeVerifier: state.verifier });
    setCookie(c, sessionCookie, encode({ exp: Date.now() / 1000 + maxAge }), cookieOptions());
    setCookie(c, stateCookie, "", cookieOptions(0));
    return c.redirect(state.callbackUrl);
  } catch {
    return c.redirect("/auth/signin?error=Callback");
  }
}

export function signOut(c: Context) {
  setCookie(c, sessionCookie, "", cookieOptions(0));
  return c.redirect("/auth/signin");
}
