import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { and, eq, gte } from "drizzle-orm";
import { polls, userNotificationPrefs, notificationLog, users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/resend";
import { isCronAuthed } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const oneDayAgo = new Date(Date.now() - 86400_000).toISOString();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const newPolls = await db.select().from(polls).where(gte(polls.createdAt, oneHourAgo));
  if (newPolls.length === 0) return NextResponse.json({ sent: 0, reason: "no new polls" });

  const optedIn = await db
    .select({ userId: userNotificationPrefs.userId })
    .from(userNotificationPrefs)
    .where(eq(userNotificationPrefs.onNewPoll, true));

  let sent = 0;
  const siteUrl = "https://volimto.sk";

  for (const { userId } of optedIn) {
    const recentLog = await db
      .select()
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.userId, userId),
          eq(notificationLog.type, "new_poll"),
          gte(notificationLog.sentAt, oneDayAgo)
        )
      );
    if (recentLog.length > 0) continue;

    const [user] = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) continue;

    const poll = newPolls[0];
    try {
      await sendEmail(
        {
          to: user.email,
          subject: `Novy prieskum — ${poll.agency}, ${poll.publishedDate}`,
          html: `<p>Bol zverejneny novy prieskum od agentury <strong>${poll.agency}</strong>.</p><p><a href="${siteUrl}/prieskumy">Zobrazit prieskumy</a></p>`,
          text: `Novy prieskum — ${poll.agency}, ${poll.publishedDate}\n\n${siteUrl}/prieskumy`,
        },
        { RESEND_API_KEY: process.env.RESEND_API_KEY! }
      );
      await db.insert(notificationLog).values({ userId, type: "new_poll", sentAt: new Date().toISOString() });
      sent++;
    } catch {
      // continue on error
    }
  }

  return NextResponse.json({ sent });
}
