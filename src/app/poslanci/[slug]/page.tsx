import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import {
  getMpBySlug,
  getMpVotes,
  getMpSpeeches,
  getMpCompanies,
  getMpContracts,
  getMpPartyPromises,
} from "@/lib/db/mps";
import MpTabs from "./MpTabs";
import VotingTab from "./tabs/VotingTab";
import SpeechesTab from "./tabs/SpeechesTab";
import PromisesTab from "./tabs/PromisesTab";
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

const VALID_TABS = ["hlasovanie", "reci", "sluby", "firmy", "zmluvy"] as const;
type Tab = (typeof VALID_TABS)[number];

export default async function MpDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
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

  let votesData: Awaited<ReturnType<typeof getMpVotes>> | null = null;
  let speechesData: Awaited<ReturnType<typeof getMpSpeeches>> | null = null;
  let promisesData: Awaited<ReturnType<typeof getMpPartyPromises>> | null = null;
  let companiesData: Awaited<ReturnType<typeof getMpCompanies>> | null = null;
  let contractsData: Awaited<ReturnType<typeof getMpContracts>> | null = null;

  if (activeTab === "hlasovanie") {
    votesData = await getMpVotes(db, mp.id, { page });
  } else if (activeTab === "reci") {
    speechesData = await getMpSpeeches(db, mp.id, { page });
  } else if (activeTab === "sluby") {
    promisesData = mp.partyId
      ? await getMpPartyPromises(db, mp.partyId)
      : [];
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
        <a href="/poslanci" className="hover:underline">Poslanci</a>
        {" / "}
        <span className="text-ink">{mp.nameDisplay}</span>
      </p>

      {/* Hero */}
      <div className="border border-border bg-card p-4 mb-6 flex flex-col sm:flex-row gap-4">
        {/* Portrait */}
        <div className="shrink-0">
          {mp.photoUrl ? (
            <img
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
      {activeTab === "reci" && speechesData && (
        <SpeechesTab
          speeches={speechesData.speeches}
          total={speechesData.total}
          page={page}
          mpSlug={slug}
          activeTab={activeTab}
        />
      )}
      {activeTab === "sluby" && promisesData && (
        <PromisesTab
          promises={promisesData}
          partyName={mp.partyName}
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
