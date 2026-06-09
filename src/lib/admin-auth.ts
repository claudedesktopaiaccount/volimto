import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { users } from "@/lib/db/schema";

async function isAdminToken(token: string | undefined, db: Database): Promise<boolean> {
  if (!token) return false;

  const session = await validateSession(token, db);
  if (!session) return false;

  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return rows[0]?.role === "admin";
}

/**
 * Verify admin access from Next.js cookies() for server components and server actions.
 */
export async function isAdminAuthedFromCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return false;
  return isAdminToken(sessionToken, getDb());
}

/**
 * Verify admin access from a NextRequest for API route handlers.
 */
export async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return false;
  return isAdminToken(sessionToken, getDb());
}
