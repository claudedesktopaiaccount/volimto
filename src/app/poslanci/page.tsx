import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db";
import { getMpsGroupedByParty } from "@/lib/db/mps-grouped";
import { parties } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import MpsBrowser from "./MpsBrowser";

export const revalidate = 86400; // 24h

export const metadata: Metadata = {
  title: "Poslanci — VolímTo",
  description:
    "Kompletný prehľad slovenských poslancov NR SR — hlasovanie, reči, sľuby a firmy.",
};

const getCachedPoslanciData = unstable_cache(
  async () => {
    const db = getDb();
    const [allParties, groupedMps] = await Promise.all([
      db.select().from(parties).orderBy(asc(parties.abbreviation)),
      getMpsGroupedByParty(db),
    ]);

    return { allParties, groupedMps };
  },
  ["poslanci-page-data"],
  { revalidate: 86400, tags: ["poslanci"] }
);

export default async function PoslanciPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
        <PoslanciHeader />
        <DatabaseUnavailable />
      </div>
    );
  }

  const { allParties, groupedMps } = await getCachedPoslanciData();

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <PoslanciHeader />
      <MpsBrowser parties={allParties} groupedMps={groupedMps} />
    </div>
  );
}

function PoslanciHeader() {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] font-extrabold text-ink">Poslanci NR SR</h1>
      <p className="text-[11px] text-muted uppercase tracking-[0.1em] mt-1">
        HLASOVANIE · REČI · SĽUBY · FIRMY
      </p>
    </div>
  );
}

function DatabaseUnavailable() {
  return (
    <div className="border border-border bg-card p-8 text-center">
      <h2 className="text-base font-bold text-ink">Databáza poslancov nie je pripojená</h2>
      <p className="mt-2 text-sm text-muted">
        V lokálnom prostredí chýba <code className="font-mono">DATABASE_URL</code>.
        Pridaj Neon Postgres URL do <code className="font-mono">.env</code> a spusti{" "}
        <code className="font-mono">npm run db:setup</code>.
      </p>
    </div>
  );
}
