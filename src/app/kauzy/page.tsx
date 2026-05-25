import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import KauzyClient from "./KauzyClient";
import { getDb } from "@/lib/db";
import { getScandalKauzy } from "@/lib/db/scandals";
import { KAUZY as FALLBACK_KAUZY } from "@/lib/kauzy-data";
import { getActiveCourtKauzy, getKauzaStats, type Kauza } from "@/lib/scandals";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kauzy a prepojenia — VolímTo",
  description:
    "Investigatívna mapa politických káuz, súdnych stavov, aktérov, inštitúcií a verejne doložených prepojení.",
};

export default async function KauzyPage() {
  const kauzy = await loadKauzy();
  const stats = getKauzaStats(kauzy);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Investigatívna mapa"
        title="Kauzy a prepojenia"
        description="Súdne stavy, aktívni politici, inštitúcie a zdroje v jednej čitateľnej mape. Každý záznam rozlišuje podozrenie, obžalobu, rozsudok a uzavretú vec."
      />

      <section className="mb-6 grid gap-px bg-border md:grid-cols-4">
        <Stat label="Kauzy v mape" value={stats.total} />
        <Stat label="Aktívne kauzy" value={stats.activeCourt} />
        <Stat label="Prebieha" value={stats.appeal} />
        <Stat label="Zdrojov" value={stats.sources} />
      </section>

      <KauzyClient kauzy={kauzy} activeCourtKauzy={getActiveCourtKauzy(kauzy)} />
    </div>
  );
}

async function loadKauzy(): Promise<Kauza[]> {
  if (!process.env.DATABASE_URL) return normalizeFallbackKauzy();

  try {
    const dbKauzy = await getScandalKauzy(getDb());
    return dbKauzy.length > 0 ? dbKauzy : normalizeFallbackKauzy();
  } catch (error) {
    console.error("[kauzy] failed to load scandals from database", error);
    return normalizeFallbackKauzy();
  }
}

function normalizeFallbackKauzy(): Kauza[] {
  return FALLBACK_KAUZY.map((kauza) => ({
    ...kauza,
    status:
      kauza.status === "active_court"
        ? "vysetruje_sa"
        : kauza.status === "appeal"
          ? "prebieha"
          : kauza.status === "closed"
            ? "zastavene"
            : "disciplinarne_potrestany",
    category:
      kauza.category === "korupcia"
        ? "korupcia"
        : kauza.category === "akademicka_etika"
          ? "plagiatorstvo"
          : kauza.category === "pravny_stat"
            ? "zneuzitie_moci"
            : "ine",
  })) as Kauza[];
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card p-4">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums text-ink">{value}</p>
    </div>
  );
}
