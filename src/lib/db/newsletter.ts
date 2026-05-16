import { eq } from "drizzle-orm";
import type { Database } from "./index";
import { newsletterSubscribers } from "./schema";

export async function isAlreadySubscribed(
  db: Database,
  email: string
): Promise<boolean> {
  const rows = await db
    .select({ id: newsletterSubscribers.id })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase().trim()))
    .limit(1);
  return rows.length > 0;
}

export async function subscribeEmail(
  db: Database,
  email: string,
  source: string = "web"
): Promise<void> {
  try {
    await db.insert(newsletterSubscribers).values({
      email: email.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
      source,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw new Error("already_subscribed", { cause: err });
    }
    throw err;
  }
}
