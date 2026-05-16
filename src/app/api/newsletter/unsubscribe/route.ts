import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { newsletterSubscribers } from "@/lib/db/schema";
import { verifyUnsubToken } from "@/lib/email/tokens";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const token = req.nextUrl.searchParams.get("token");

  if (!email || !token) {
    return new NextResponse("Neplatn\u00fd odkaz.", { status: 400 });
  }

  const valid = await verifyUnsubToken(token, email, process.env.CRON_SECRET ?? "");
  if (!valid) {
    return new NextResponse("Neplatn\u00fd alebo expirovan\u00fd odkaz.", { status: 400 });
  }

  const db = getDb();
  await db
    .update(newsletterSubscribers)
    .set({ unsubscribedAt: new Date().toISOString() })
    .where(eq(newsletterSubscribers.email, email.toLowerCase()));

  return new NextResponse(
    `<!DOCTYPE html><html lang="sk"><body style="font-family:Georgia,serif;padding:40px;max-width:600px;margin:auto">
      <h1>Odhl\u00e1senie \u00faspe\u0161n\u00e9</h1>
      <p>Va\u0161a adresa <strong>${escapeHtml(email)}</strong> bola odhl\u00e1sen\u00e1 z odberu newslettera VolímTo.</p>
      <p><a href="https://volimto.sk">Sp\u00e4\u0165 na VolímTo</a></p>
    </body></html>`,
    { headers: { "Content-Type": "text/html;charset=utf-8" } }
  );
}
