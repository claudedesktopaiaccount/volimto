import { NextRequest } from "next/server";
import { GET as scrapeMpActivities } from "@/app/api/cron/scrape-mp-activities/route";
import { GET as scrapeNews } from "@/app/api/cron/scrape-news/route";
import { GET as scrapeNrsr } from "@/app/api/cron/scrape-nrsr/route";
import { GET as scrapeOpendata } from "@/app/api/cron/scrape-opendata/route";
import { GET as scrapePolls } from "@/app/api/cron/scrape-polls/route";
import { GET as scrapePrograms } from "@/app/api/cron/scrape-programs/route";
import { GET as scrapeScandals } from "@/app/api/cron/scrape-scandals/route";
import {
  formatOpendataImportError,
  runConfiguredOpendataImport,
} from "@/lib/opendata-import";
import {
  SCRAPER_JOB_IDS,
  SCRAPER_JOB_OPTIONS,
  type ScraperJobId,
} from "./scraper-job-options";

type ScraperHandler = (req: NextRequest) => Promise<Response>;

const HANDLERS: Record<ScraperJobId, { path: string; handler: ScraperHandler }> = {
  polls: { path: "/api/cron/scrape-polls", handler: scrapePolls },
  news: { path: "/api/cron/scrape-news", handler: scrapeNews },
  programs: { path: "/api/cron/scrape-programs", handler: scrapePrograms },
  nrsr: { path: "/api/cron/scrape-nrsr", handler: scrapeNrsr },
  "mp-activities": { path: "/api/cron/scrape-mp-activities", handler: scrapeMpActivities },
  opendata: { path: "/api/cron/scrape-opendata", handler: scrapeOpendata },
  scandals: { path: "/api/cron/scrape-scandals", handler: scrapeScandals },
};

export interface ScraperRunResult {
  ok: boolean;
  status: number;
  data: unknown;
}

export function parseScraperJobIds(input: unknown): ScraperJobId[] {
  if (!Array.isArray(input)) return [];

  const validIds = new Set<string>(SCRAPER_JOB_IDS);
  const unique: ScraperJobId[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !validIds.has(item)) continue;
    const id = item as ScraperJobId;
    if (!unique.includes(id)) unique.push(id);
  }
  return unique;
}

export function getScraperJobMeta(id: ScraperJobId) {
  return SCRAPER_JOB_OPTIONS.find((job) => job.id === id);
}

export async function runScraperJob(id: ScraperJobId): Promise<ScraperRunResult> {
  // The admin endpoint is already authenticated. Run OpenData's shared import
  // service directly so a manual import does not depend on a second secret.
  if (id === "opendata") {
    try {
      const result = await runConfiguredOpendataImport();
      return {
        ok: true,
        status: 200,
        data: { ok: true, ...result },
      };
    } catch (error) {
      return {
        ok: false,
        status: 502,
        data: formatOpendataImportError(error),
      };
    }
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("Missing CRON_SECRET for internal scraper run");
  }

  const job = HANDLERS[id];
  const req = new NextRequest(`https://volimto.local${job.path}`, {
    headers: { authorization: `Bearer ${secret}` },
  });
  const response = await job.handler(req);
  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
