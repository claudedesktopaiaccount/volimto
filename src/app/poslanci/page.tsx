import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getMps } from "@/lib/db/mps";
import { getMpsGroupedByParty } from "@/lib/db/mps-grouped";
import { parties } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";
import MpFilters from "./MpFilters";
import { MpCard } from "./MpCard";
import { CoalitionBlock } from "./CoalitionBlock";

export const metadata: Metadata = {
  title: "Poslanci — VolímTo",
  description:
    "Kompletný prehľad slovenských poslancov NR SR — hlasovanie, reči, sľuby a firmy.",
};

export const revalidate = 3600;

const PAGE_SIZE = 24;

export default async function PoslanciPage({
  searchParams,
}: {
  searchParams: Promise<{
    party?: string;
    search?: string;
    page?: string;
    view?: string;
  }>;
}) {
  const db = getDb();
  const params = await searchParams;
  const party = params.party ?? "";
  const search = params.search ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  // Filter or search → always flat. Otherwise default to grouped.
  const view: "grouped" | "flat" =
    party || search ? "flat" : params.view === "flat" ? "flat" : "grouped";

  const allParties = await db
    .select()
    .from(parties)
    .orderBy(asc(parties.abbreviation));

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold text-ink">Poslanci NR SR</h1>
        <p className="text-[11px] text-muted uppercase tracking-[0.1em] mt-1">
          HLASOVANIE · REČI · SĽUBY · FIRMY
        </p>
      </div>

      <MpFilters parties={allParties} />

      {view === "grouped" ? (
        <GroupedView />
      ) : (
        <FlatView page={page} party={party} search={search} />
      )}
    </div>
  );
}

async function GroupedView() {
  const db = getDb();
  const { coalition, opposition, independent } = await getMpsGroupedByParty(db);

  return (
    <>
      <CoalitionBlock label="Vládna koalícia" groups={coalition} inverted />
      <CoalitionBlock label="Opozícia" groups={opposition} />
      {independent.length > 0 && (
        <div className="mb-8">
          <div className="flex items-baseline justify-between px-4 py-3 mb-3 bg-card text-ink border border-border">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] font-mono">
              Nezaradení
            </h2>
            <span className="text-xs font-mono">{independent.length}</span>
          </div>
          <div className="border border-border bg-card p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {independent.map((mp) => (
              <MpCard key={mp.id} mp={mp} compact />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

async function FlatView({
  page,
  party,
  search,
}: {
  page: number;
  party: string;
  search: string;
}) {
  const db = getDb();
  const { mps: mpList, total } = await getMps(db, {
    party: party || undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <p className="text-xs text-muted font-mono mb-4">
        {total === 0
          ? "Žiadni poslanci"
          : `Zobrazených ${from}–${to} z ${total} poslancov`}
      </p>

      {mpList.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-muted text-sm">
          Žiadni poslanci nevyhovujú filtrom.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {mpList.map((mp) => (
            <MpCard key={mp.id} mp={mp} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-4 mt-8">
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1, party, search)}
              className="border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-hover"
            >
              ← Predchádzajúca
            </Link>
          ) : (
            <span className="border border-border bg-surface px-4 py-2 text-sm text-muted opacity-40 cursor-not-allowed">
              ← Predchádzajúca
            </span>
          )}

          <span className="text-xs font-mono text-muted">
            {page} / {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={buildPageHref(page + 1, party, search)}
              className="border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-hover"
            >
              Ďalšia →
            </Link>
          ) : (
            <span className="border border-border bg-surface px-4 py-2 text-sm text-muted opacity-40 cursor-not-allowed">
              Ďalšia →
            </span>
          )}
        </div>
      )}
    </>
  );
}

function buildPageHref(page: number, party: string, search: string): string {
  const p = new URLSearchParams();
  p.set("view", "flat");
  if (party) p.set("party", party);
  if (search) p.set("search", search);
  if (page > 1) p.set("page", String(page));
  return `?${p.toString()}`;
}
