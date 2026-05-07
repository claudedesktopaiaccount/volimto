import { getDb } from "./index";
import { polls, newsItems, predictions } from "./schema";
import { desc } from "drizzle-orm";

export async function getLastUpdate(): Promise<string | null> {
  try {
    const db = getDb();
    const [p, n, pr] = await Promise.all([
      db.select({ t: polls.createdAt }).from(polls).orderBy(desc(polls.createdAt)).limit(1),
      db.select({ t: newsItems.scrapedAt }).from(newsItems).orderBy(desc(newsItems.scrapedAt)).limit(1),
      db.select({ t: predictions.generatedAt }).from(predictions).orderBy(desc(predictions.generatedAt)).limit(1),
    ]);
    const candidates = [p[0]?.t, n[0]?.t, pr[0]?.t].filter(Boolean) as string[];
    if (candidates.length === 0) return null;
    const max = candidates.sort().at(-1)!;
    const d = new Date(max);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("sk-SK", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return null;
  }
}
