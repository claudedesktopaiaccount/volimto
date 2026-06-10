import { and, count, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { subscribeEmail } from "@/lib/db/newsletter";
import { hashString } from "@/lib/hash";

const RATE_LIMIT = 5;
const RATE_WINDOW_S = 60 * 60;

export type NewsletterSubscribeResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "too_many_requests" | "already_subscribed" | "server_error" };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribeToNewsletter(input: {
  email: string;
  source?: string;
  ip?: string | null;
}): Promise<NewsletterSubscribeResult> {
  const email = input.email.trim();
  if (!isValidEmail(email)) return { ok: false, error: "invalid_email" };

  const db = getDb();
  const ip = input.ip || "unknown";
  const ipHash = await hashString(`newsletter:${ip}`);
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - RATE_WINDOW_S;

  const rateResult = await db
    .select({ c: count() })
    .from(rateLimits)
    .where(and(eq(rateLimits.ipHash, ipHash), gte(rateLimits.createdAt, cutoff)));

  if (rateResult[0].c >= RATE_LIMIT) {
    return { ok: false, error: "too_many_requests" };
  }

  await db.insert(rateLimits).values({ ipHash, createdAt: now });
  await db.delete(rateLimits).where(lt(rateLimits.createdAt, cutoff));

  try {
    await subscribeEmail(db, email, input.source ?? "web");
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "already_subscribed") {
      return { ok: false, error: "already_subscribed" };
    }

    console.error("Newsletter subscribe error:", error);
    return { ok: false, error: "server_error" };
  }
}
