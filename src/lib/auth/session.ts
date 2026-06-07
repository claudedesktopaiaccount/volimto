import { type Database } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";

export const SESSION_COOKIE = "volimto_session";
const SESSION_DURATION_DAYS = 30;

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  userId: string,
  db: Database
): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(userSessions).values({
    id: tokenHash,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function validateSession(
  token: string,
  db: Database
): Promise<{ userId: string } | null> {
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const rows = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.id, tokenHash))
    .limit(1);

  const session = rows[0];
  if (!session) return null;

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  if (expiresAt <= now) {
    await db.delete(userSessions).where(eq(userSessions.id, tokenHash));
    return null;
  }

  return { userId: session.userId };
}

export async function deleteSession(token: string, db: Database): Promise<void> {
  const tokenHash = await hashToken(token);
  await db.delete(userSessions).where(eq(userSessions.id, tokenHash));
}

async function deleteExpiredSessions(db: Database): Promise<void> {
  const now = new Date().toISOString();
  await db.delete(userSessions).where(lt(userSessions.expiresAt, now));
}

export function sessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
    expires: new Date(expiresAt),
  };
}
