import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import PageHeader from "@/components/ui/PageHeader";
import { getDb } from "@/lib/db";
import {
  getOpendataAnalytics,
  type OpendataAnalyticsData,
} from "@/lib/db/opendata-analytics";
import {
  hasActiveContractFilters,
  parseOpendataFilters,
  type OpendataFilters as Filters,
  type OpendataSearchParams,
} from "@/lib/opendata-dashboard";
import { isStaticBuild, withTimeout } from "@/lib/runtime-data";
import OpendataFilters from "./OpendataFilters";
import {
  CompanyStats,
  CompaniesView,
  ContractStats,
  ContractsView,
  ItmsStats,
  OpendataScopeNotice,
  OpendataTabs,
  OverviewView,
  PoliticsView,
} from "./OpendataViews";

export const revalidate = 21_600;

export const metadata: Metadata = {
  title: "Kam tečú verejné peniaze — VolímTo",
  description:
    "Interaktívny prehľad zmlúv CRZ, projektov ITMS a firiem RPVS so zdrojovo overenými politickými väzbami.",
};

const getCachedOpendata = unstable_cache(
  async (filters: Filters, todayIso: string) =>
    getOpendataAnalytics(getDb(), filters, todayIso),
  ["opendata-analytics-v3"],
  { revalidate: 21_600, tags: ["opendata"] }
);

export default async function OpendataPage({
  searchParams,
}: {
  searchParams: Promise<OpendataSearchParams>;
}) {
  const filters = parseOpendataFilters(await searchParams);
  const result = await loadOpendata(filters);

  if (result.status === "unavailable") {
    return (
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
        <PageHeader
          eyebrow="Otvorené dáta"
          title="Kam tečú verejné peniaze"
          description="Interaktívny prehľad zmlúv CRZ, projektov ITMS a firiem z importu RPVS."
        />
        <section
          role="status"
          className="rounded-panel border border-warning-border bg-warning-bg p-6 text-sm text-ink"
        >
          <h2 className="font-bold">Dáta sa teraz nepodarilo načítať</h2>
          <p className="mt-2 text-secondary">
            Toto nie je nulový výsledok. Databáza je dočasne nedostupná; skúste
            stránku obnoviť o chvíľu.
          </p>
        </section>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Otvorené dáta"
        title="Kam tečú verejné peniaze"
        description={`${formatCount(data.dataset.contractCount)} zmlúv CRZ, ${formatCount(data.itmsSummary.projectCount)} projektov ITMS a ${formatCount(data.dataset.rpvsCompanyCount)} firiem v importe RPVS.`}
        className="mb-5"
      />

      <OpendataScopeNotice
        linkedContractCount={data.dataset.linkedContractCount}
        linkedItmsProjectCount={data.itmsSummary.linkedProjectCount}
      />
      <OpendataTabs filters={filters} data={data} />

      {filters.view === "companies" ? (
        <CompanyStats data={data} />
      ) : filters.view === "politics" ? (
        <ItmsStats data={data} />
      ) : (
        <ContractStats data={data} filtered={hasActiveContractFilters(filters)} />
      )}

      {filters.view !== "politics" && (
        <OpendataFilters
          key={`${filters.view}:${filters.query}`}
          filters={filters}
          years={data.years}
          parties={data.partyOptions}
          legalForms={data.legalForms}
        />
      )}

      {filters.view === "overview" && <OverviewView data={data} filters={filters} />}
      {filters.view === "contracts" && <ContractsView data={data} filters={filters} />}
      {filters.view === "companies" && <CompaniesView data={data} filters={filters} />}
      {filters.view === "politics" && <PoliticsView data={data} filters={filters} />}
    </div>
  );
}

async function loadOpendata(filters: Filters): Promise<
  | { status: "ready"; data: OpendataAnalyticsData }
  | { status: "unavailable" }
> {
  if (!process.env.DATABASE_URL || isStaticBuild()) {
    return { status: "unavailable" };
  }

  try {
    const todayIso = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Bratislava",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const data = await withTimeout(
      "opendata analytics database load",
      () => getCachedOpendata(filters, todayIso),
      8_000
    );
    return { status: "ready", data };
  } catch (error) {
    console.error("[opendata] failed to load analytics", error);
    return { status: "unavailable" };
  }
}

function formatCount(value: number): string {
  return value.toLocaleString("sk-SK");
}
