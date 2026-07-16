import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { DataTable, DataTd, DataTh } from "@/components/ui/DataTable";
import Panel from "@/components/ui/Panel";
import type {
  OpendataAnalyticsData,
  OpendataContractRow,
  OpendataPartyRankingRow,
  OpendataRankedEntity,
  Pagination,
} from "@/lib/db/opendata-analytics";
import {
  opendataHref,
  type OpendataFilters,
  type OpendataView,
} from "@/lib/opendata-dashboard";
import OpendataTimelineChart from "./OpendataTimelineChart";

const eur = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 });
const itmsAmount = new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 2 });

export function OpendataScopeNotice({
  linkedContractCount,
  linkedItmsProjectCount,
}: {
  linkedContractCount: number;
  linkedItmsProjectCount: number;
}) {
  return (
    <aside className="mb-6 rounded-panel border border-accent-border bg-accent-soft p-4 sm:flex sm:items-start sm:gap-4">
      <span
        aria-hidden="true"
        className="mb-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-white sm:mb-0"
      >
        i
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-ink">Čo tento prehľad meria</h2>
        <p className="mt-1 text-sm leading-relaxed text-secondary">
          CRZ ukazuje hodnotu zmluvy a ITMS zazmluvnenú sumu projektu — ani jedno
          samo osebe neznamená peniaze prijaté politickou stranou. Verejne zobrazujeme
          iba väzby doložené presným IČO, časovým prekryvom v RPVS a úplnou identitou
          politika.
        </p>
      </div>
      <div className="mt-3 shrink-0 border-t border-accent-border pt-3 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <p className="text-label text-muted">OVERENÉ VÄZBY</p>
        <p className="mt-1 text-xl font-extrabold tabular-nums text-ink">
          {integer.format(linkedContractCount + linkedItmsProjectCount)}
        </p>
      </div>
    </aside>
  );
}

export function OpendataTabs({
  filters,
  data,
}: {
  filters: OpendataFilters;
  data: OpendataAnalyticsData;
}) {
  const tabs: Array<{ view: OpendataView; label: string; count?: number }> = [
    { view: "overview", label: "Prehľad" },
    { view: "contracts", label: "Zmluvy CRZ", count: data.totals.contractCount },
    { view: "companies", label: "Firmy RPVS", count: data.companySummary.companyCount },
    {
      view: "politics",
      label: "Politické väzby",
      count: data.dataset.linkedContractCount + data.itmsSummary.linkedProjectCount,
    },
  ];

  return (
    <nav aria-label="Pohľady otvorených dát" className="mb-5 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = filters.view === tab.view;
          return (
            <Link
              key={tab.view}
              href={tabHref(filters, tab.view)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 ${
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:border-border-strong hover:text-ink"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-pill px-2 py-0.5 text-xs tabular-nums ${
                    active ? "bg-ink text-paper" : "bg-subtle text-muted"
                  }`}
                >
                  {integer.format(tab.count)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function tabHref(filters: OpendataFilters, view: OpendataView): string {
  if (view === "companies") {
    return opendataHref(filters, {
      view,
      year: "",
      amount: "all",
      rpvs: "all",
      link: "all",
      partyId: "",
      sort: "newest",
      page: 1,
    });
  }

  return opendataHref(filters, {
    view,
    legalForm: "",
    companySort: "contracts",
    page: 1,
  });
}

export function ContractStats({
  data,
  filtered,
}: {
  data: OpendataAnalyticsData;
  filtered: boolean;
}) {
  const { totals, dataset } = data;
  return (
    <section aria-label="Súhrn zmlúv" className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-border lg:grid-cols-4">
      <Stat
        label={filtered ? "Zmluvy vo výbere" : "Importované zmluvy"}
        value={integer.format(totals.contractCount)}
        note={filtered ? `z ${integer.format(dataset.contractCount)} zmlúv` : `${integer.format(dataset.supplierCount)} dodávateľov`}
      />
      <Stat
        label="Hodnota zmlúv"
        value={eur.format(totals.contractAmount)}
        note={`${percent(totals.positiveAmountCount, totals.contractCount)} má kladnú hodnotu`}
      />
      <Stat
        label="Medián známej hodnoty"
        value={eur.format(totals.medianPositiveAmount)}
        note="odolnejší voči veľkým zákazkám"
      />
      <Stat
        label="Nájdené v RPVS importe"
        value={eur.format(totals.rpvsContractAmount)}
        note={`${integer.format(totals.rpvsContractCount)} zmlúv podľa presného IČO`}
      />
    </section>
  );
}

export function CompanyStats({ data }: { data: OpendataAnalyticsData }) {
  const { companySummary, dataset } = data;
  return (
    <section aria-label="Súhrn firiem RPVS" className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-border lg:grid-cols-4">
      <Stat
        label="Firmy vo výbere"
        value={integer.format(companySummary.companyCount)}
        note={`z ${integer.format(dataset.rpvsCompanyCount)} v importe`}
      />
      <Stat
        label="S nájdenou zmluvou CRZ"
        value={integer.format(companySummary.companiesWithContracts)}
        note="presná zhoda IČO v oboch importoch"
      />
      <Stat
        label="Nájdené zmluvy"
        value={integer.format(companySummary.contractCount)}
        note="v aktuálnom importe CRZ"
      />
      <Stat
        label="Hodnota nájdených zmlúv"
        value={eur.format(companySummary.contractAmount)}
        note="nejde o úplné pokrytie RPVS"
      />
    </section>
  );
}

export function ItmsStats({ data }: { data: OpendataAnalyticsData }) {
  const summary = data.itmsSummary;
  return (
    <section aria-label="Súhrn projektov ITMS" className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-border lg:grid-cols-4">
      <Stat
        label="Projekty ITMS"
        value={integer.format(summary.projectCount)}
        note={`${integer.format(summary.activeProjectCount)} v realizácii · ${integer.format(summary.completedProjectCount)} ukončených`}
      />
      <Stat
        label="Zazmluvnená suma ITMS"
        value={itmsAmount.format(summary.contractedAmount)}
        note="API neposiela samostatné pole meny"
      />
      <Stat
        label="Väzba na politika"
        value={integer.format(summary.linkedProjectCount)}
        note="presné IČO + RPVS obdobie + celé meno a dátum narodenia"
      />
      <Stat
        label="Priamy príjemca strana"
        value={integer.format(summary.directPartyProjectCount)}
        note="presná zhoda IČO s oficiálnym registrom 11 strán"
      />
    </section>
  );
}

export function OverviewView({
  data,
  filters,
}: {
  data: OpendataAnalyticsData;
  filters: OpendataFilters;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel className="lg:col-span-2" padding="md">
        <SectionIntro
          title="Vývoj hodnoty zmlúv"
          description="Najviac 18 posledných mesiacov s dátumom v očakávanom rozsahu. Graf sa mení podľa filtrov."
        />
        <OpendataTimelineChart data={data.monthly} />
      </Panel>

      <RankingPanel
        title="Najväčší dodávatelia"
        description="Sčítané podľa IČO; názov je posledný variant nájdený v dátach."
        items={data.topSuppliers}
        filters={filters}
      />
      <RankingPanel
        title="Najväčší verejní objednávatelia"
        description="Sčítané podľa presného názvu; odlišný pravopis môže jednu inštitúciu rozdeliť."
        items={data.topAuthorities}
        filters={filters}
      />

      <PoliticalSnapshot data={data} filters={filters} />
      <DataQuality data={data} />
    </div>
  );
}

export function ContractsView({
  data,
  filters,
}: {
  data: OpendataAnalyticsData;
  filters: OpendataFilters;
}) {
  const { contractPagination: pagination } = data;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SectionIntro
          title="Zmluvy CRZ"
          description="Hodnota, dátum a názvy sú prevzaté zo zdrojového záznamu CRZ."
          className="mb-0"
        />
        <ResultRange pagination={pagination} noun="zmlúv" />
      </div>

      {data.contracts.length === 0 ? (
        <EmptyState
          title="Žiadna zmluva nevyhovuje filtrom"
          text="Skúste zmeniť hľadaný výraz, obdobie alebo hranicu hodnoty."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-panel border border-border bg-card md:block">
            <DataTable className="min-w-[980px]">
              <thead className="border-b border-border bg-subtle">
                <tr>
                  <DataTh className="w-24 text-left">Dátum</DataTh>
                  <DataTh className="w-[28%] text-left">Predmet</DataTh>
                  <DataTh className="w-[20%] text-left">Objednávateľ</DataTh>
                  <DataTh className="w-[22%] text-left">Dodávateľ</DataTh>
                  <DataTh className="text-left">Kontext</DataTh>
                  <DataTh className="w-32 text-right">Hodnota</DataTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {data.contracts.map((contract) => (
                  <ContractTableRow key={contract.id} contract={contract} />
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="space-y-3 md:hidden">
            {data.contracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        </>
      )}

      <PaginationNav pagination={pagination} filters={filters} />
    </section>
  );
}

export function CompaniesView({
  data,
  filters,
}: {
  data: OpendataAnalyticsData;
  filters: OpendataFilters;
}) {
  const { companyPagination: pagination } = data;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SectionIntro
          title="Firmy v importe RPVS"
          description="Prepojenie na CRZ vzniká iba presnou zhodou IČO. Samotný záznam RPVS neznamená politickú väzbu."
          className="mb-0"
        />
        <ResultRange pagination={pagination} noun="firiem" />
      </div>

      {data.companies.length === 0 ? (
        <EmptyState
          title="Žiadna firma nevyhovuje filtrom"
          text="Skúste kratší názov, IČO alebo inú právnu formu."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-panel border border-border bg-card md:block">
            <DataTable className="min-w-[820px]">
              <thead className="border-b border-border bg-subtle">
                <tr>
                  <DataTh className="text-left">Firma</DataTh>
                  <DataTh className="w-40 text-left">Právna forma</DataTh>
                  <DataTh className="w-32 text-right">Zmluvy CRZ</DataTh>
                  <DataTh className="w-44 text-right">Hodnota zmlúv</DataTh>
                  <DataTh className="w-28 text-right">Zdroj</DataTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {data.companies.map((company) => (
                  <tr key={company.id} className="align-top hover:bg-hover/60">
                    <DataTd className="py-3">
                      <p className="font-semibold text-ink">{company.name}</p>
                      <p className="mt-1 font-mono text-micro text-muted">IČO {company.ico}</p>
                      {company.addressSk && (
                        <p className="mt-1 text-xs text-muted">{company.addressSk}</p>
                      )}
                    </DataTd>
                    <DataTd className="py-3 text-muted">
                      {company.legalForm ?? "Neuvedená"}
                    </DataTd>
                    <DataTd className="py-3 text-right tabular-nums">
                      {company.contractCount > 0 ? integer.format(company.contractCount) : "—"}
                    </DataTd>
                    <DataTd className="py-3 text-right font-semibold tabular-nums text-ink">
                      {company.contractCount > 0 ? eur.format(company.contractAmount) : "—"}
                    </DataTd>
                    <DataTd className="py-3 text-right">
                      <ExternalLink href={company.sourceUrl}>RPVS ↗</ExternalLink>
                    </DataTd>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="space-y-3 md:hidden">
            {data.companies.map((company) => (
              <article key={company.id} className="rounded-panel border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{company.name}</h3>
                    <p className="mt-1 font-mono text-xs text-muted">IČO {company.ico}</p>
                  </div>
                  {company.legalForm && <Badge>{company.legalForm}</Badge>}
                </div>
                {company.addressSk && <p className="mt-2 text-xs text-muted">{company.addressSk}</p>}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-divider pt-3 text-sm">
                  <div>
                    <p className="text-xs text-muted">Zmluvy CRZ</p>
                    <p className="mt-1 font-semibold tabular-nums text-ink">
                      {integer.format(company.contractCount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Hodnota</p>
                    <p className="mt-1 font-semibold tabular-nums text-ink">
                      {company.contractCount > 0 ? eur.format(company.contractAmount) : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <ExternalLink href={company.sourceUrl}>Detail v RPVS ↗</ExternalLink>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <PaginationNav pagination={pagination} filters={filters} />
    </section>
  );
}

export function PoliticsView({
  data,
  filters,
}: {
  data: OpendataAnalyticsData;
  filters: OpendataFilters;
}) {
  return (
    <section className="space-y-6">
      <SectionIntro
        title="Projekty ITMS s overenou väzbou prijímateľa na politika"
        description="Každý riadok prešiel cestou projekt → presné IČO prijímateľa → časovo platný zápis RPVS → KUV → presná identita politika podľa celého mena a dátumu narodenia. Neznamená to, že politik alebo jeho strana peniaze prijali."
        className="mb-0"
      />

      {data.linkedItmsProjects.length === 0 ? (
        <Panel padding="lg">
          <p className="text-sm text-secondary">
            Import zatiaľ neobsahuje žiadnu kompletne overenú cestu. Zhodu mena
            ani súčasnú stranícku príslušnosť samostatne nepovažujeme za dôkaz.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3">
          {data.linkedItmsProjects.map((project, index) => (
            <article
              key={`${project.id}-${project.politicianId}-${index}`}
              className="rounded-panel border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="success">Overená RPVS väzba</Badge>
                    <span className="font-mono text-micro text-muted">
                      {project.projectCode} · {formatOptionalDate(project.effectiveDate)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold leading-snug text-ink">
                    <a href={project.sourceUrl} className="hover:text-accent hover:underline">
                      {project.titleSk}
                    </a>
                  </h3>
                  <p className="mt-2 text-sm text-secondary">
                    Prijímateľ: <strong className="text-ink">{project.recipientName ?? "Názov nie je v zoznamovom ITMS zázname"}</strong>
                    {project.recipientIco ? ` · IČO ${project.recipientIco}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    Časovo platný KUV v RPVS: <strong className="text-ink">{project.politicianName}</strong>
                  </p>
                  {project.currentPartyName && (
                    <p className="mt-1 text-xs text-muted">
                      Súčasné zaradenie v databáze: {project.currentPartyName}
                      {project.currentPartyAbbreviation ? ` (${project.currentPartyAbbreviation})` : ""}.
                      Toto zaradenie nepoužívame na pripísanie projektu strane.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
                    <a href={project.rpvsRegistrationSourceUrl} className="text-accent hover:underline">Zápis RPVS →</a>
                    <a href={project.rpvsBeneficialOwnerSourceUrl} className="text-accent hover:underline">História KUV →</a>
                    <a href={project.politicianSourceUrl} className="text-accent hover:underline">Identita NR SR →</a>
                  </div>
                </div>
                <div className="shrink-0 rounded-md bg-subtle p-3 lg:min-w-52 lg:text-right">
                  <p className="text-label text-muted">ZAZMLUVNENÁ SUMA ITMS</p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums text-ink">
                    {itmsAmount.format(project.contractedAmount)}
                  </p>
                  <p className="mt-1 text-micro text-muted">API nemá samostatné pole meny</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Panel padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label text-muted">PRIAMY PRÍJEMCA — POLITICKÁ STRANA</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink">
              {integer.format(data.itmsSummary.directPartyProjectCount)}
            </p>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-secondary">
            Porovnávame IČO prijímateľa projektu s časovo platnou právnou identitou
            všetkých 11 sledovaných strán z registra MV SR. {data.itmsSummary.directPartyProjectCount === 0
              ? "Aktuálny ITMS import nemá ani jednu presnú zhodu, preto žiadnu zazmluvnenú sumu strane nepripisujeme."
              : "Nižšie uvádzame iba projekty s presnou zhodou IČO a platného registračného obdobia strany."}
          </p>
        </div>
      </Panel>

      {data.directPartyItmsProjects.length > 0 && (
        <div className="grid gap-3">
          {data.directPartyItmsProjects.map((project) => (
            <article
              key={`${project.id}-${project.partyId}`}
              className="rounded-panel border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Badge tone="success">Presné IČO strany</Badge>
                  <h3 className="mt-2 font-bold text-ink">
                    <a href={project.sourceUrl} className="hover:text-accent hover:underline">
                      {project.titleSk}
                    </a>
                  </h3>
                  <p className="mt-1 text-sm text-secondary">
                    {project.partyName} ({project.partyAbbreviation}) · IČO {project.recipientIco}
                  </p>
                  <a href={project.registrySourceUrl} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
                    Právna identita strany v registri MV SR →
                  </a>
                </div>
                <div className="shrink-0 text-sm font-bold tabular-nums text-ink">
                  {itmsAmount.format(project.contractedAmount)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div>
        <SectionIntro
          title="Zmluvy CRZ s overenou väzbou dodávateľa"
          description="Samostatná vetva pre verejné zmluvy. Ani tu nejde o platby politickým stranám."
        />
        {data.partyRanking.length > 0 ? (
          <PartyRanking rows={data.partyRanking} filters={filters} />
        ) : (
          <Panel padding="md">
            <p className="text-sm text-secondary">
              V aktuálnom výreze CRZ nie je zmluva s jednoznačnou a časovo platnou
              väzbou dodávateľa na politika. Kontrakt TEMPRA (IČO 31639607) preto
              správne zostáva bez politickej väzby.
            </p>
          </Panel>
        )}
      </div>

      <Panel variant="subtle" padding="md">
        <h3 className="text-sm font-bold text-ink">Metodické obmedzenie</h3>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Zazmluvnená suma nie je dátumovaná platba. Databáza navyše zatiaľ nemá
          zdrojovo úplnú históriu straníckych afiliácií. Súčasnú stranu politika
          preto zobrazujeme iba ako dnešný kontext a nesčítavame podľa nej projekty.
        </p>
        <Link href="/metodika#zdroje-dat" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          Ako pracujeme so zdrojmi →
        </Link>
      </Panel>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 bg-card p-4 sm:p-5">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-2 break-words text-xl font-extrabold tracking-tight tabular-nums text-ink sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>
    </div>
  );
}

function SectionIntro({
  title,
  description,
  className = "mb-4",
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-lg font-extrabold text-ink sm:text-xl">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

function RankingPanel({
  title,
  description,
  items,
  filters,
}: {
  title: string;
  description: string;
  items: OpendataRankedEntity[];
  filters: OpendataFilters;
}) {
  const max = Math.max(...items.map((item) => item.amount), 0);

  return (
    <Panel padding="md">
      <SectionIntro title={title} description={description} />
      {items.length === 0 ? (
        <p className="rounded-md bg-subtle p-5 text-center text-sm text-muted">
          Pre vybrané filtre nie sú dostupné výsledky.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => (
            <li key={`${item.name}-${item.secondaryLabel ?? ""}`}>
              <Link
                href={opendataHref(filters, {
                  view: "contracts",
                  query: item.secondaryLabel ?? item.name,
                  page: 1,
                })}
                scroll={false}
                className="group block"
              >
                <div className="mb-1 flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0 text-secondary">
                    <span className="mr-2 font-mono text-muted">{index + 1}.</span>
                    <span className="font-semibold text-ink group-hover:text-accent">{item.name}</span>
                    {item.secondaryLabel && (
                      <span className="ml-1 font-mono text-micro text-muted">IČO {item.secondaryLabel}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                    {eur.format(item.amount)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-pill bg-subtle">
                  <div
                    className="h-full rounded-pill bg-accent transition-[width]"
                    style={{ width: `${barWidth(item.amount, max)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-micro text-muted">
                  {integer.format(item.count)} {plural(item.count, "zmluva", "zmluvy", "zmlúv")}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function PoliticalSnapshot({
  data,
  filters,
}: {
  data: OpendataAnalyticsData;
  filters: OpendataFilters;
}) {
  if (data.partyRanking.length > 0) {
    return <PartyRanking rows={data.partyRanking} filters={filters} className="lg:col-span-2" />;
  }

  return (
    <Panel padding="md" className="lg:col-span-2">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-ink">Politické členenie</h2>
            <Badge tone={data.itmsSummary.linkedProjectCount > 0 ? "success" : undefined}>
              {integer.format(data.itmsSummary.linkedProjectCount)} overených ITMS projektov
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
            ITMS projekty vieme prepojiť na politikov cez presné IČO, časovo platný
            zápis RPVS a plný dátum narodenia. Sumu podľa súčasnej strany zámerne
            nesčítavame, kým nemáme historické afiliácie k dátumu projektu.
          </p>
        </div>
        <Link
          href={opendataHref(filters, { view: "politics", page: 1 })}
          className="shrink-0 rounded-md border border-ink px-4 py-2 text-center text-sm font-semibold text-ink hover:bg-ink hover:text-paper"
        >
          Zobraziť dôkazové cesty
        </Link>
      </div>
    </Panel>
  );
}

function PartyRanking({
  rows,
  filters,
  className,
}: {
  rows: OpendataPartyRankingRow[];
  filters: OpendataFilters;
  className?: string;
}) {
  const max = Math.max(...rows.map((row) => row.amount), 0);
  return (
    <Panel padding="md" className={className}>
      <SectionIntro
        title="Hodnota zmlúv podľa súčasnej strany prepojeného politika"
        description="Iba zmluvy s overenou a v deň podpisu platnou firemnou väzbou. Nejde o platby stranám."
      />
      <ol className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.partyId ?? "independent"}>
            <Link
              href={opendataHref(filters, {
                view: "contracts",
                partyId: row.partyId ?? "",
                link: "linked",
                page: 1,
              })}
              scroll={false}
              className="group block"
            >
              <div className="mb-1.5 flex items-end justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 font-mono text-xs text-muted">{index + 1}.</span>
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="truncate text-sm font-bold text-ink group-hover:text-accent">
                    {row.abbreviation} — {row.partyName}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
                  {eur.format(row.amount)}
                </span>
              </div>
              <div className="ml-7 h-3 overflow-hidden rounded-pill bg-subtle">
                <div
                  className="h-full rounded-pill"
                  style={{ width: `${barWidth(row.amount, max)}%`, backgroundColor: row.color }}
                />
              </div>
              <p className="mt-1 ml-7 text-xs text-muted">
                {integer.format(row.contractCount)} zmlúv · {integer.format(row.politicianCount)} politikov
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function DataQuality({ data }: { data: OpendataAnalyticsData }) {
  const { totals } = data;
  const items = [
    {
      value: percent(totals.positiveAmountCount, totals.contractCount),
      label: "zmlúv má kladnú hodnotu",
      note: `${integer.format(totals.zeroAmountCount)} riadkov má 0 € alebo neuvedenú sumu`,
    },
    {
      value: integer.format(totals.unusualDateCount),
      label: "neštandardných dátumov",
      note: "pred rokom 2011 alebo po dnešnom dni",
    },
    {
      value: percent(totals.rpvsContractCount, totals.contractCount),
      label: "presných zhôd s RPVS importom",
      note: "podľa IČO, nie podľa názvu",
    },
    {
      value: integer.format(totals.linkedContractCount),
      label: "zmlúv s overenou politickou väzbou",
      note: "neoverené a nejednoznačné väzby vynechávame",
    },
  ];

  return (
    <Panel padding="md" className="lg:col-span-2">
      <SectionIntro
        title="Pokrytie a kvalita dát"
        description="Dôležité limity, ktoré bránia tomu, aby čísla pôsobili presnejšie, než v skutočnosti sú."
      />
      <dl className="grid gap-px overflow-hidden rounded-md bg-border sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-subtle p-4">
            <dt className="text-xs font-semibold text-secondary">{item.label}</dt>
            <dd className="mt-1">
              <span className="block text-2xl font-extrabold tabular-nums text-ink">{item.value}</span>
              <span className="mt-2 block text-micro leading-relaxed text-muted">{item.note}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ContractTableRow({ contract }: { contract: OpendataContractRow }) {
  return (
    <tr className="align-top hover:bg-hover/60">
      <DataTd className="py-3 font-mono text-muted">{formatDate(contract.signedDate)}</DataTd>
      <DataTd className="py-3">
        <Link href={`/opendata/contracts/${contract.id}`} className="font-semibold text-ink hover:text-accent hover:underline">
          {contract.titleSk}
        </Link>
      </DataTd>
      <DataTd className="py-3 text-secondary">{contract.contractingAuthority}</DataTd>
      <DataTd className="py-3">
        <p className="font-semibold text-ink">{contract.supplierName}</p>
        <p className="mt-1 font-mono text-micro text-muted">IČO {contract.supplierIco}</p>
      </DataTd>
      <DataTd className="py-3">
        <ContractContext contract={contract} />
      </DataTd>
      <DataTd className="py-3 text-right">
        <Amount value={contract.amountEur} />
      </DataTd>
    </tr>
  );
}

function ContractCard({ contract }: { contract: OpendataContractRow }) {
  return (
    <article className="rounded-panel border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs text-muted">{formatDate(contract.signedDate)}</p>
        <Amount value={contract.amountEur} />
      </div>
      <h3 className="mt-2 font-bold leading-snug text-ink">
        <Link href={`/opendata/contracts/${contract.id}`} className="text-ink hover:text-accent hover:underline">
          {contract.titleSk}
        </Link>
      </h3>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Objednávateľ</dt>
          <dd className="mt-0.5 text-secondary">{contract.contractingAuthority}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Dodávateľ</dt>
          <dd className="mt-0.5 font-semibold text-ink">{contract.supplierName}</dd>
          <dd className="mt-0.5 font-mono text-xs text-muted">IČO {contract.supplierIco}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-divider pt-3">
        <ContractContext contract={contract} />
      </div>
    </article>
  );
}

function ContractContext({ contract }: { contract: OpendataContractRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {contract.rpvsUrl && (
        <a href={contract.rpvsUrl} target="_blank" rel="noopener noreferrer">
          <Badge tone="accent" className="hover:border-accent">Firma v RPVS ↗</Badge>
        </a>
      )}
      {contract.politicianId && (
        <Badge tone="success">
          Overená väzba: {contract.politicianName}
          {contract.partyAbbreviation ? ` · ${contract.partyAbbreviation}` : ""}
        </Badge>
      )}
      {!contract.rpvsUrl && !contract.politicianId && (
        <span className="text-xs text-muted">Bez doplnenej väzby</span>
      )}
    </div>
  );
}

function Amount({ value }: { value: number }) {
  return value > 0 ? (
    <span className="font-semibold tabular-nums text-ink">{eur.format(value)}</span>
  ) : (
    <span className="text-xs text-muted">0 € / neuvedené</span>
  );
}

function ResultRange({ pagination, noun }: { pagination: Pagination; noun: string }) {
  const page = Math.min(pagination.page, pagination.totalPages);
  const from = pagination.totalCount === 0 ? 0 : (page - 1) * pagination.pageSize + 1;
  const to = Math.min(page * pagination.pageSize, pagination.totalCount);
  return (
    <p className="shrink-0 text-xs text-muted">
      {from > 0 ? `${integer.format(from)}–${integer.format(to)} z ` : ""}
      {integer.format(pagination.totalCount)} {noun}
    </p>
  );
}

function PaginationNav({
  pagination,
  filters,
}: {
  pagination: Pagination;
  filters: OpendataFilters;
}) {
  if (pagination.totalPages <= 1) return null;

  const page = Math.min(pagination.page, pagination.totalPages);
  return (
    <nav aria-label="Stránkovanie výsledkov" className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
      {page > 1 ? (
        <Link
          href={opendataHref(filters, { page: page - 1 })}
          scroll={false}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-ink hover:border-ink"
        >
          ← Predchádzajúca
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-muted">
        Strana {integer.format(page)} z {integer.format(pagination.totalPages)}
      </span>
      {page < pagination.totalPages ? (
        <Link
          href={opendataHref(filters, { page: page + 1 })}
          scroll={false}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-ink hover:border-ink"
        >
          Ďalšia →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-panel border border-dashed border-border-strong bg-card p-10 text-center">
      <h3 className="font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

function ExternalLink({
  href,
  children,
  className = "text-xs font-semibold text-accent hover:underline",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatOptionalDate(value: string | null): string {
  return value ? formatDate(value) : "dátum v ITMS neuvedený";
}

function percent(part: number, total: number): string {
  if (total <= 0) return "0 %";
  return `${new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 1 }).format((part / total) * 100)} %`;
}

function barWidth(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(2, (value / max) * 100);
}

function plural(value: number, one: string, few: string, many: string): string {
  if (value === 1) return one;
  if (value >= 2 && value <= 4) return few;
  return many;
}
