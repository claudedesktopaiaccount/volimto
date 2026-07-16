import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import { getOpenDataContractDetail } from "@/lib/db/opendata-contract-detail";

export const revalidate = 21_600;

export const metadata: Metadata = {
  title: "Detail zmluvy CRZ — VolímTo",
  description:
    "Detail importovanej zmluvy z Centrálneho registra zmlúv vrátane dodávateľa, hodnoty a overeného kontextu.",
};

export default async function OpenDataContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseContractId(rawId);
  if (id === null) notFound();

  const contract = await getOpenDataContractDetail(id);
  if (!contract) notFound();

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <Link
        href="/opendata?view=contracts"
        className="mb-4 inline-flex text-xs font-semibold text-accent hover:underline"
      >
        ← Späť na zmluvy CRZ
      </Link>

      <PageHeader
        eyebrow={`Zmluva CRZ · záznam #${contract.id}`}
        title={contract.titleSk}
        description={`${contract.contractingAuthority} → ${contract.supplierName}`}
        className="mb-5"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel padding="lg" className="lg:col-span-2">
          <h2 className="text-lg font-extrabold text-ink">Údaje zmluvy</h2>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-md bg-border sm:grid-cols-2">
            <DetailItem label="Predmet zmluvy" wide>
              {contract.titleSk}
            </DetailItem>
            <DetailItem label="Číslo zmluvy">
              {contract.contractNumber || "Neuvedené"}
            </DetailItem>
            <DetailItem label="Interné ID záznamu">{contract.id}</DetailItem>
            <DetailItem label="Dátum podpisu">{formatDate(contract.signedDate)}</DetailItem>
            <DetailItem label="Hodnota">{formatAmount(contract.amountEur)}</DetailItem>
            <DetailItem label="CPV kód">{contract.cpvCode || "Neuvedené"}</DetailItem>
            <DetailItem label="Objednávateľ" wide>
              {contract.contractingAuthority}
            </DetailItem>
            <DetailItem label="Dodávateľ" wide>
              {contract.supplierName}
            </DetailItem>
            <DetailItem label="IČO dodávateľa">{contract.supplierIco}</DetailItem>
          </dl>
        </Panel>

        <div className="space-y-5">
          <Panel padding="md">
            <h2 className="text-sm font-extrabold text-ink">Zdrojový záznam</h2>
            <p className="mt-2 break-all font-mono text-xs leading-relaxed text-muted">
              {contract.sourceUrl}
            </p>
            <a
              href={contract.sourceUrl}
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-ink px-4 py-2.5 text-sm font-bold text-paper hover:opacity-90"
            >
              Otvoriť zdroj v CRZ →
            </a>
          </Panel>

          <Panel padding="md">
            <h2 className="text-sm font-extrabold text-ink">Kontext dodávateľa</h2>
            {contract.rpvsCompanyName ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-semibold text-ink">{contract.rpvsCompanyName}</p>
                {contract.rpvsLegalForm && (
                  <p className="text-secondary">Právna forma: {contract.rpvsLegalForm}</p>
                )}
                {contract.rpvsAddress && (
                  <p className="text-secondary">Sídlo: {contract.rpvsAddress}</p>
                )}
                {contract.rpvsUrl && (
                  <a href={contract.rpvsUrl} className="inline-flex font-semibold text-accent hover:underline">
                    Detail firmy v RPVS →
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Dodávateľ nebol nájdený v aktuálnom importe RPVS podľa presného IČO.
              </p>
            )}
          </Panel>

          <Panel padding="md">
            <h2 className="text-sm font-extrabold text-ink">Politická väzba</h2>
            {contract.linkedPoliticianId && contract.linkedPoliticianName ? (
              <div className="mt-3 text-sm">
                {contract.linkedPoliticianSlug ? (
                  <Link
                    href={`/poslanci/${contract.linkedPoliticianSlug}`}
                    className="font-bold text-accent hover:underline"
                  >
                    {contract.linkedPoliticianName}
                  </Link>
                ) : (
                  <p className="font-bold text-ink">{contract.linkedPoliticianName}</p>
                )}
                {(contract.partyAbbreviation || contract.partyName) && (
                  <p className="mt-1 text-secondary">
                    Súčasná strana: {contract.partyAbbreviation || contract.partyName}
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Zobrazené iba pri už overenej firemnej väzbe na politika.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Bez overenej politickej väzby.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`bg-subtle p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function parseContractId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
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

function formatAmount(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
