import { eq } from "drizzle-orm";
import { type Database } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";

export type ApiKeyRecord = typeof apiKeys.$inferSelect;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a new free API key for a user.
 * Returns the raw key (shown once) and the stored record.
 */
export async function createApiKey(
  userId: string,
  db: Database
): Promise<{ rawKey: string; record: ApiKeyRecord }> {
  const rawKey = `volimto_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyHash = await sha256Hex(rawKey);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(apiKeys)
    .values({ id, userId, keyHash, tier: "free", createdAt: now });

  const [record] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id));

  return { rawKey, record };
}

/**
 * Looks up an API key by raw value. Returns null if not found or revoked.
 */
export async function lookupApiKey(
  rawKey: string,
  db: Database
): Promise<ApiKeyRecord | null> {
  const keyHash = await sha256Hex(rawKey);
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash));

  if (rows.length === 0 || rows[0].revokedAt !== null) return null;
  return rows[0];
}
