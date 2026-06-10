import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { desc, sql } from "drizzle-orm";
import PageHeader from "@/components/ui/PageHeader";
import { getDb } from "@/lib/db";
import { companies, contracts, donations, parties, politicianCompanyLinks } from "@/lib/db/schema";
import { isStaticBuild, withTimeout } from "@/lib/runtime-data";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Opendata — VolímTo",
  description:
    "Verejné zmluvy, dary politickým stranám a firemné prepojenia politikov z otvorených dát.",
};

const eur = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const getCachedOpendata = unstable_cache(
  async () => {
    const db = getDb();

    const [contractRows, donationRows, companyRows, totals] = await Promise.all([
      db
        .select({
          id: contracts.id,
          titleSk: contracts.titleSk,
          supplierName: contracts.supplierName,
          amountEur: contracts.amountEur,
          signedDate: contracts.signedDate,
          sourceUrl: contracts.sourceUrl,
        })
        .from(contracts)
        .orderBy(desc(contracts.signedDate))
        .limit(8),
      db
        .select({
          id: donations.id,
          partyName: parties.name,
          donorName: donations.donorName,
          amountEur: donations.amountEur,
          donationDate: donations.donationDate,
          sourceUrl: donations.sourceUrl,
        })
        .from(donations)
        .leftJoin(parties, sql`${parties.id} = ${donations.partyId}`)
        .orderBy(desc(donations.amountEur))
        .limit(8),
      db
        .select({
          id: politicianCompanyLinks.id,
          companyName: companies.name,
          ico: companies.ico,
          relationship: politicianCompanyLinks.relationship,
          sourceUrl: politicianCompanyLinks.sourceUrl,
        })
        .from(politicianCompanyLinks)
        .innerJoin(companies, sql`${politicianCompanyLinks.companyId} = ${companies.id}`)
        .orderBy(desc(politicianCompanyLinks.id))
        .limit(8),
      db
        .select({
          contractCount: sql<number>`count(distinct ${contracts.id})`.mapWith(Number),
          contractAmount: sql<number>`coalesce(sum(${contracts.amountEur}), 0)`.mapWith(Number),
        })
        .from(contracts),
    ]);

    return {
      contracts: contractRows,
      donations: donationRows,
      companies: companyRows,
      totals: totals[0] ?? { contractCount: 0, contractAmount: 0 },
    };
  },
  ["opendata-page-data"],
  { revalidate: 21600, tags: ["opendata"] }
);

export default async function OpendataPage() {
  const data = await loadOpendata();

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Otvorené dáta"
        title="Zmluvy, dary a firemné prepojenia"
        description="Prvý verejný pohľad na dátové vrstvy, ktoré doteraz žili hlavne v profile poslanca a v admin/scraper infraštruktúre."
      />

      <section className="mb-8 grid gap-px bg-border sm:grid-cols-2">
        <Stat label="Zmlúv v databáze" value={data.totals.contractCount.toLocaleString("sk-SK")} />
        <Stat label="Hodnota zmlúv" value={eur.format(data.totals.contractAmount)} />
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <DataBlock title="Najnovšie zmluvy">
          {data.contracts.length === 0 ? (
            <Empty />
          ) : (
            data.contracts.map((contract) => (
              <a key={contract.id} href={contract.sourceUrl} target="_blank" rel="noopener" className="block border-b border-divider py-3 hover:bg-hover">
                <p className="text-xs font-mono text-muted">{contract.signedDate}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{contract.titleSk}</p>
                <p className="mt-1 text-xs text-muted">{contract.supplierName}</p>
                <p className="mt-1 text-sm font-mono text-ink">{eur.format(contract.amountEur)}</p>
              </a>
            ))
          )}
        </DataBlock>

        <DataBlock title="Najväčšie dary stranám">
          {data.donations.length === 0 ? (
            <Empty />
          ) : (
            data.donations.map((donation) => (
              <a key={donation.id} href={donation.sourceUrl} target="_blank" rel="noopener" className="block border-b border-divider py-3 hover:bg-hover">
                <p className="text-xs font-mono text-muted">{donation.donationDate}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{donation.donorName}</p>
                <p className="mt-1 text-xs text-muted">{donation.partyName ?? "Neznáma strana"}</p>
                <p className="mt-1 text-sm font-mono text-ink">{eur.format(donation.amountEur)}</p>
              </a>
            ))
          )}
        </DataBlock>

        <DataBlock title="Firemné prepojenia">
          {data.companies.length === 0 ? (
            <Empty />
          ) : (
            data.companies.map((company) => (
              <a key={company.id} href={company.sourceUrl} target="_blank" rel="noopener" className="block border-b border-divider py-3 hover:bg-hover">
                <p className="text-xs font-mono text-muted">IČO {company.ico}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{company.companyName}</p>
                <p className="mt-1 text-xs text-muted">{company.relationship}</p>
              </a>
            ))
          )}
        </DataBlock>
      </div>
    </div>
  );
}

async function loadOpendata() {
  if (!process.env.DATABASE_URL || isStaticBuild()) {
    return {
      contracts: [],
      donations: [],
      companies: [],
      totals: { contractCount: 0, contractAmount: 0 },
    };
  }

  try {
    return await withTimeout("opendata database load", () => getCachedOpendata());
  } catch (error) {
    console.error("[opendata] failed to load data", error);
    return {
      contracts: [],
      donations: [],
      companies: [],
      totals: { contractCount: 0, contractAmount: 0 },
    };
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function DataBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-b-3 border-ink pb-2 text-lg font-extrabold text-ink">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty() {
  return (
    <div className="border border-border bg-card p-6 text-sm text-muted">
      Dáta zatiaľ nie sú dostupné.
    </div>
  );
}
