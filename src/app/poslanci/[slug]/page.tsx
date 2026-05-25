import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";
import {
  getMpBySlug,
  getMpVotes,
  getMpSpeeches,
  getMpCompanies,
  getMpContracts,
  getMpDetailOverview,
  getMpActivityStats,
  getMpLegislation,
  getMpAmendments,
  getMpInterpellations,
  getMpQuestions,
} from "@/lib/db/mps";
import MpTabs from "./MpTabs";
import MpActivityStrip from "./MpActivityStats";
import MpActivityOverview from "./MpActivityOverview";
import VotingTab from "./tabs/VotingTab";
import SpeechesTab from "./tabs/SpeechesTab";
import LegislationTab from "./tabs/LegislationTab";
import CompaniesTab from "./tabs/CompaniesTab";
import ContractsTab from "./tabs/ContractsTab";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const mp = await getMpBySlug(db, slug);
  if (!mp) return { title: "Poslanec — VolímTo" };
  return {
    title: `${mp.nameDisplay} — VolímTo`,
    description: `Hlasovanie, reči, sľuby a firmy: kompletný záznam poslanca ${mp.nameFull}${mp.partyAbbr ? ` (${mp.partyAbbr})` : ""}.`,
  };
}

const VALID_TABS = ["hlasovanie", "reci", "predlozene", "firmy", "zmluvy"] as const;
type Tab = (typeof VALID_TABS)[number];

export default async function MpDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; page?: string; sub?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const db = getDb();
  const mp = await getMpBySlug(db, slug);
  if (!mp) notFound();

  const rawTab = sp.tab ?? "hlasovanie";
  const activeTab: Tab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as Tab)
    : "hlasovanie";
  const page = Math.max(1, Number(sp.page) || 1);

  // ─── Fetch only active tab data ───────────────────────────────────────────

  const VALID_SUBS = ["reci", "interpelacie", "otazky"] as const;
  type Sub = (typeof VALID_SUBS)[number];
  const rawSub = sp.sub ?? "reci";
  const activeSub: Sub = (VALID_SUBS as readonly string[]).includes(rawSub)
    ? (rawSub as Sub)
    : "reci";

  let votesData: Awaited<ReturnType<typeof getMpVotes>> | null = null;
  let speechesData: Awaited<ReturnType<typeof getMpSpeeches>> | null = null;
  let interpellationsData: Awaited<ReturnType<typeof getMpInterpellations>> | null = null;
  let questionsData: Awaited<ReturnType<typeof getMpQuestions>> | null = null;
  let legislationData: Awaited<ReturnType<typeof getMpLegislation>> | null = null;
  let amendmentsData: Awaited<ReturnType<typeof getMpAmendments>> | null = null;
  let companiesData: Awaited<ReturnType<typeof getMpCompanies>> | null = null;
  let contractsData: Awaited<ReturnType<typeof getMpContracts>> | null = null;

  const [stats, overview] = await Promise.all([
    getMpActivityStats(db, mp.id),
    getMpDetailOverview(db, mp.id),
  ]);

  if (activeTab === "hlasovanie") {
    votesData = await getMpVotes(db, mp.id, { page });
  } else if (activeTab === "reci") {
    if (activeSub === "interpelacie") {
      interpellationsData = await getMpInterpellations(db, mp.id, { page });
    } else if (activeSub === "otazky") {
      questionsData = await getMpQuestions(db, mp.id, { page });
    } else {
      speechesData = await getMpSpeeches(db, mp.id, { page });
    }
  } else if (activeTab === "predlozene") {
    [legislationData, amendmentsData] = await Promise.all([
      getMpLegislation(db, mp.id, { pageSize: 50 }),
      getMpAmendments(db, mp.id, { pageSize: 50 }),
    ]);
  } else if (activeTab === "firmy") {
    companiesData = await getMpCompanies(db, mp.id);
  } else if (activeTab === "zmluvy") {
    contractsData = await getMpContracts(db, mp.id, { page });
  }

  // ─── Hero ─────────────────────────────────────────────────────────────────

  const initial = mp.nameDisplay.charAt(0).toUpperCase();

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <p className="text-xs text-muted font-mono mb-4">
        <Link href="/poslanci" className="hover:underline">Poslanci</Link>
        {" / "}
        <span className="text-ink">{mp.nameDisplay}</span>
      </p>

      {/* Hero */}
      <div className="border border-border bg-card p-4 mb-6 flex flex-col sm:flex-row gap-4">
        {/* Portrait */}
        <div className="shrink-0">
          {mp.photoUrl ? (
            <Image
              src={mp.photoUrl}
              alt={mp.nameDisplay}
              width={80}
              height={80}
              className="w-20 h-20 object-cover border border-border"
            />
          ) : (
            <div className="w-20 h-20 bg-surface border border-border flex items-center justify-center text-muted font-mono text-2xl font-bold">
              {initial}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-[24px] font-serif font-bold text-ink leading-tight">
            {mp.nameDisplay}
          </h1>
          {mp.nameFull && mp.nameFull !== mp.nameDisplay && (
            <p className="text-xs text-muted">{mp.nameFull}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-1">
            {mp.partyAbbr && (
              <span
                className="inline-block px-1.5 py-0.5 text-[10px] font-bold text-white leading-none"
                style={{ backgroundColor: mp.partyColor ?? "#555" }}
              >
                {mp.partyAbbr}
              </span>
            )}
            {mp.constituency && (
              <span className="text-xs text-muted">{mp.constituency}</span>
            )}
            {mp.birthYear && (
              <span className="text-xs font-mono text-muted">
                nar. {mp.birthYear}
              </span>
            )}
            {mp.role && mp.role !== "poslanec" && (
              <span className="text-xs font-mono text-muted uppercase">
                {mp.role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Aktivita stat strip */}
      <MpActivityStrip stats={stats} />

      <MpActivityOverview overview={overview} mpSlug={slug} />

      {/* Tabs nav (client component) */}
      <MpTabs activeTab={activeTab} mpSlug={slug} />

      {/* Tab content (server-rendered) */}
      {activeTab === "hlasovanie" && votesData && (
        <VotingTab
          records={votesData.records}
          total={votesData.total}
          page={page}
          mpSlug={slug}
          activeTab={activeTab}
        />
      )}
      {activeTab === "reci" && (
        <SpeechesTab
          activeSub={activeSub}
          mpSlug={slug}
          page={page}
          speeches={speechesData?.speeches ?? null}
          speechesTotal={speechesData?.total ?? 0}
          interpellations={interpellationsData?.rows ?? null}
          interpellationsTotal={interpellationsData?.total ?? 0}
          questions={questionsData?.rows ?? null}
          questionsTotal={questionsData?.total ?? 0}
        />
      )}
      {activeTab === "predlozene" && legislationData && amendmentsData && (
        <LegislationTab
          legislation={legislationData.rows}
          amendments={amendmentsData.rows}
        />
      )}
      {activeTab === "firmy" && companiesData && (
        <CompaniesTab companies={companiesData} />
      )}
      {activeTab === "zmluvy" && contractsData && (
        <ContractsTab
          contracts={contractsData.contracts}
          total={contractsData.total}
          totalAmount={contractsData.totalAmount}
          page={page}
          mpSlug={slug}
          activeTab={activeTab}
        />
      )}
    </div>
  );
}
