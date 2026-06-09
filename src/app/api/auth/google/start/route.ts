import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleOAuthCookieOptions,
  safeAuthNextPath,
} from "@/lib/auth/google";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google prihlásenie nie je nakonfigurované" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const nextPath = safeAuthNextPath(request.nextUrl.searchParams.get("next"));
  const redirectUri = new URL("/api/auth/google/callback", request.nextUrl.origin).toString();
  const authUrl = new URL(GOOGLE_AUTH_URL);

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, googleOAuthCookieOptions());
  response.cookies.set(GOOGLE_OAUTH_NEXT_COOKIE, nextPath, googleOAuthCookieOptions());

  return response;
}
