import { and, eq } from "drizzle-orm";
import { type Database } from "@/lib/db";
import { apiUsage } from "@/lib/db/schema";

const FREE_TIER_DAILY_LIMIT = 100;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function checkAndIncrement(
  keyId: string,
  tier: string,
  db: Database
): Promise<{ allowed: boolean; remaining?: number }> {
  if (tier === "paid") {
    return { allowed: true };
  }

  const date = todayUtc();
  const rows = await db
    .select({ count: apiUsage.count })
    .from(apiUsage)
    .where(and(eq(apiUsage.keyId, keyId), eq(apiUsage.date, date)));

  const current = rows[0]?.count ?? 0;
  if (current >= FREE_TIER_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  // Upsert: insert or increment count
  await db
    .insert(apiUsage)
    .values({ keyId, date, count: 1 })
    .onConflictDoUpdate({
      target: [apiUsage.keyId, apiUsage.date],
      set: { count: current + 1 },
    });

  return { allowed: true, remaining: FREE_TIER_DAILY_LIMIT - current - 1 };
}
