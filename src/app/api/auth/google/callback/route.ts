import { OAuth2Client } from "google-auth-library";
import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleEmailAllowed,
  safeAuthNextPath,
} from "@/lib/auth/google";
import { timingSafeEqual } from "@/lib/hash";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
};

function jsonError(message: string, status: number) {
  const response = NextResponse.json({ error: message }, { status });
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_NEXT_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonError("Google prihlásenie nie je nakonfigurované", 500);
  }

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return jsonError("Google prihlásenie bolo odmietnuté", 400);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !stateCookie || !(await timingSafeEqual(state, stateCookie))) {
    return jsonError("Neplatný stav Google prihlásenia", 400);
  }

  const redirectUri = new URL("/api/auth/google/callback", request.nextUrl.origin).toString();
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return jsonError("Google prihlásenie zlyhalo", 400);
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenData.id_token) {
    return jsonError("Google nevrátil identitu používateľa", 400);
  }

  let payload: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({
      idToken: tokenData.id_token,
      audience: clientId,
    });
    payload = ticket.getPayload() ?? {};
  } catch {
    return jsonError("Google identitu sa nepodarilo overiť", 400);
  }

  const email = payload.email?.trim().toLowerCase();
  if (!payload.sub || !email || !payload.email_verified) {
    return jsonError("Google účet nemá overený e-mail", 403);
  }

  if (!(await isGoogleEmailAllowed(email))) {
    return jsonError("Tento Google účet nemá prístup", 403);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const visitorId = request.cookies.get("pt_visitor")?.value ?? null;
  const displayName = payload.name?.trim() || email;

  const existingRows = await db
    .select()
    .from(users)
    .where(or(eq(users.googleSub, payload.sub), eq(users.email, email)))
    .limit(1);

  let user = existingRows[0];
  if (user) {
    await db
      .update(users)
      .set({
        email,
        googleSub: payload.sub,
        displayName,
        role: "admin",
        emailVerifiedAt: now,
        visitorId: user.visitorId ?? visitorId,
      })
      .where(eq(users.id, user.id));

    user = {
      ...user,
      email,
      googleSub: payload.sub,
      displayName,
      role: "admin",
      emailVerifiedAt: now,
      visitorId: user.visitorId ?? visitorId,
    };
  } else {
    user = {
      id: crypto.randomUUID(),
      email,
      passwordHash: null,
      googleSub: payload.sub,
      displayName,
      role: "admin",
      createdAt: now,
      emailVerifiedAt: now,
      visitorId,
    };
    await db.insert(users).values(user);
  }

  const { token, expiresAt } = await createSession(user.id, db);
  const nextPath = safeAuthNextPath(request.cookies.get(GOOGLE_OAUTH_NEXT_COOKIE)?.value);
  const response = NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_NEXT_COOKIE);

  return response;
}
