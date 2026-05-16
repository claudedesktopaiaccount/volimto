import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { userNotificationPrefs } from "@/lib/db/schema";
import { validateSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const db = getDb();
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await validateSession(sessionToken, db);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await db
    .select()
    .from(userNotificationPrefs)
    .where(eq(userNotificationPrefs.userId, session.userId));

  if (prefs.length === 0) {
    return NextResponse.json({ onNewPoll: false, onScoreChange: false });
  }
  return NextResponse.json({
    onNewPoll: prefs[0].onNewPoll,
    onScoreChange: prefs[0].onScoreChange,
  });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await validateSession(sessionToken, db);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { onNewPoll: boolean; onScoreChange: boolean };
  const now = new Date().toISOString();

  await db
    .insert(userNotificationPrefs)
    .values({
      userId: session.userId,
      onNewPoll: body.onNewPoll,
      onScoreChange: body.onScoreChange,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userNotificationPrefs.userId],
      set: {
        onNewPoll: body.onNewPoll,
        onScoreChange: body.onScoreChange,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true });
}
