import type { NextRequest, NextResponse } from "next/server";

const COOKIE_PREFIX = "oauth_";
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function setOAuthCookies(
  response: NextResponse,
  provider: string,
  state: string,
  codeVerifier?: string
) {
  const options = buildCookieOptions();
  response.cookies.set(`${COOKIE_PREFIX}${provider}_state`, state, options);
  if (codeVerifier) {
    response.cookies.set(`${COOKIE_PREFIX}${provider}_verifier`, codeVerifier, options);
  }
}

export function readOAuthCookies(request: NextRequest, provider: string) {
  const state = request.cookies.get(`${COOKIE_PREFIX}${provider}_state`)?.value ?? "";
  const codeVerifier = request.cookies.get(`${COOKIE_PREFIX}${provider}_verifier`)?.value ?? "";
  return { state, codeVerifier };
}

export function clearOAuthCookies(response: NextResponse, provider: string) {
  response.cookies.set(`${COOKIE_PREFIX}${provider}_state`, "", { path: "/", maxAge: 0 });
  response.cookies.set(`${COOKIE_PREFIX}${provider}_verifier`, "", { path: "/", maxAge: 0 });
}
