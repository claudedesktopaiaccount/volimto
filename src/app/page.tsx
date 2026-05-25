import PollStrip from "@/components/PollStrip";
import Link from "next/link";
import { getLatestPolls } from "@/lib/poll-data";
import { getAggregatedPolls } from "@/lib/poll-aggregate";
import { getDb } from "@/lib/db";
import { PARTIES } from "@/lib/parties";
import { allocateSeats } from "@/lib/prediction/dhondt";
import { runSimulation, type PartyInput } from "@/lib/prediction/monte-carlo";
import {
  PredikciaMini,
  SimulatorMini,
  PrieskumyMini,
  type MiniPartyBar,
  type MiniSeatSlice,
} from "@/components/home/FeaturePreviews";
import { buttonClasses } from "@/components/ui/Button";

export const revalidate = 3600;

function pollWord(count: number): string {
  return count === 1 ? "prieskumu" : "prieskumov";
}

export default async function Home() {
  const db = process.env.DATABASE_URL ? getDb() : undefined;
  const pollData = await getLatestPolls(db).catch(() => ({
    parties: [],
    latestAgency: "—",
    latestDate: "—",
    pollCount: 0,
  }));
  const aggregated = await getAggregatedPolls().catch(() => []);

  const predictionInputs: PartyInput[] =
    aggregated.length > 0
      ? aggregated.map((p) => ({
          partyId: p.partyId,
          meanPct: p.meanPct,
          stdDev: p.stdDev,
        }))
      : pollData.parties.map((p) => ({
          partyId: p.partyId,
          meanPct: p.percentage,
          stdDev: p.percentage > 10 ? 2.5 : p.percentage > 5 ? 2.0 : 1.5,
        }));

  const predictionPollCount =
    aggregated.length > 0
      ? Math.max(...aggregated.map((p) => p.pollCount))
      : pollData.pollCount;

  const predictionBars: MiniPartyBar[] =
    predictionInputs.length > 0
      ? runSimulation(predictionInputs)
          .map((result) => {
            const party = PARTIES[result.partyId];
            return {
              label: party?.abbreviation ?? result.partyId.toUpperCase(),
              pct: Math.round(result.winProbability * 100),
              color: party?.color ?? "#777",
            };
          })
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 5)
      : [];

  const seatPreview: MiniSeatSlice[] = allocateSeats(
    pollData.parties.map((p) => ({ partyId: p.partyId, percentage: p.percentage }))
  )
    .map((seat) => ({
      color: PARTIES[seat.partyId]?.color ?? "#777",
      seats: seat.seats,
    }))
    .sort((a, b) => b.seats - a.seats);

  const pollPreview: MiniPartyBar[] = pollData.parties.slice(0, 10).map((party) => ({
    label: party.abbreviation,
    pct: party.percentage,
    color: party.color,
  }));

  const latestSource = `${pollData.latestAgency}, ${pollData.latestDate}`;

  const FEATURE_CARDS = [
    {
      href: "/predikcia",
      title: "Predikcia volieb",
      desc:
        predictionPollCount > 0
          ? `Monte Carlo simulácia na základe ${predictionPollCount} ${pollWord(predictionPollCount)}. Pravdepodobnosť prvenstva každej strany.`
          : "Monte Carlo simulácia bude dostupná po načítaní prieskumov.",
      preview: <PredikciaMini bars={predictionBars} pollCount={predictionPollCount} />,
    },
    {
      href: "/koalicny-simulator",
      title: "Koaličný simulátor",
      desc: `Mandáty prepočítané z najnovšieho prieskumu: ${latestSource}.`,
      preview: <SimulatorMini seats={seatPreview} />,
    },
    {
      href: "/prieskumy",
      title: "Prieskumy",
      desc: `Najnovší dostupný prieskum: ${latestSource}.`,
      preview: <PrieskumyMini parties={pollPreview} agency={pollData.latestAgency} date={pollData.latestDate} />,
    },
    {
      href: "/kauzy",
      title: "Kauzy a prepojenia",
      desc: "Investigatívna mapa aktívnych súdov, politikov, inštitúcií a verejne doložených prepojení.",
      preview: <KauzyMini />,
    },
  ];

  return (
    <main>
      {/* Hero */}
      <section className="border-b border-border bg-subtle px-6 pb-12 pt-12 text-center md:pb-14">
        <div className="max-w-content mx-auto">
          <p className="mb-4 text-label text-muted">
            SLOVENSKÉ VOĽBY 2026
          </p>
          <h1 className="mb-4 text-5xl font-extrabold leading-tight text-ink [text-wrap:balance] md:text-6xl lg:text-7xl">
            Kde stojíš v slovenskej politike?
          </h1>
          <p className="mx-auto mb-5 max-w-xl text-base leading-relaxed text-secondary md:mb-6 md:text-lg">
            20 otázok. 2 minúty. Zisti, ktoré strany zastupujú tvoje hodnoty.
          </p>
          <Link
            href="/volebny-kalkulator"
            className={buttonClasses({ variant: "primary", size: "lg", className: "text-sm" })}
          >
            Spustiť kalkulačku →
          </Link>
        </div>
      </section>

      {/* Poll strip */}
      {pollData.parties.length > 0 && (
        <PollStrip
          parties={pollData.parties}
          agency={pollData.latestAgency ?? "—"}
          date={pollData.latestDate ?? "—"}
        />
      )}

      {/* Feature cards */}
      <section className="max-w-content mx-auto px-4 py-10 sm:px-6 md:py-14">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-label text-muted">Dáta a nástroje</p>
            <h2 className="mt-2 text-2xl font-extrabold text-ink md:text-3xl">
              Rýchly prehľad volieb
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-secondary">
            Predikcie, mandáty, prieskumy a kauzy na jednom mieste.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURE_CARDS.map((card, i) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex min-h-[360px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="text-micro font-mono text-muted tabular-nums">
                  0{i + 1}
                </span>
                <span className="text-label text-muted">
                  {card.title}
                </span>
              </div>
              <div className="flex h-[220px] shrink-0 items-center justify-center border-b border-border bg-[linear-gradient(135deg,var(--bg-subtle),#fff_58%,var(--accent-soft))] p-4">
                {card.preview}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="mb-2 text-lg font-extrabold text-ink">
                  {card.title}
                </h3>
                <p className="text-sm leading-6 text-secondary">
                  {card.desc}
                </p>
                <span className="mt-auto pt-5 text-sm font-bold text-accent transition-colors group-hover:text-ink">
                  Otvoriť →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function KauzyMini() {
  const nodes = [
    { label: "Očistec", x: 50, y: 44, tone: "bg-danger", drift: "group-hover:-translate-y-1" },
    { label: "Gašpar", x: 28, y: 70, tone: "bg-accent", drift: "group-hover:-translate-x-1" },
    { label: "ŠTS", x: 72, y: 70, tone: "bg-ink", drift: "group-hover:translate-x-1" },
    { label: "Súmrak", x: 46, y: 86, tone: "bg-warning", drift: "group-hover:translate-y-1" },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center p-3">
      <div className="relative h-[172px] w-[232px] overflow-hidden rounded-md border border-border bg-card/90 shadow-sm transition-[scale,border-color,box-shadow] duration-500 ease-out group-hover:scale-[1.025] group-hover:border-accent-border group-hover:shadow-panel">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          <path
            d="M50 44 28 70M50 44 72 70M50 44 46 86"
            stroke="var(--border-strong)"
            strokeWidth="1.2"
            className="transition-[opacity,stroke-width] duration-500 ease-out group-hover:opacity-80"
          />
          <circle
            cx="50"
            cy="44"
            r="18"
            fill="var(--accent-soft)"
            stroke="var(--accent-border)"
            strokeWidth="1"
            className="transition-[scale,opacity] duration-700 ease-out group-hover:scale-125 group-hover:opacity-75"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          <circle
            cx="50"
            cy="44"
            r="8"
            fill="var(--bg-card)"
            stroke="var(--accent-blue)"
            strokeWidth="1"
            className="transition-[scale,stroke-width] duration-500 ease-out group-hover:scale-110 group-hover:stroke-[1.4]"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        </svg>
        {nodes.map((node, index) => (
          <div
            key={node.label}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <div
              className={`rounded-sm border border-border-strong bg-card px-2.5 py-1.5 text-[10px] font-bold text-ink shadow-sm transition-[translate,scale,border-color,box-shadow] duration-500 ease-out group-hover:scale-[1.06] group-hover:border-accent-border group-hover:shadow-panel ${node.drift}`}
              style={{ transitionDelay: `${index * 55}ms` }}
            >
              <span className={`mr-1 inline-block size-2 transition-[scale] duration-500 group-hover:scale-125 ${node.tone}`} />
              {node.label}
            </div>
          </div>
        ))}
        <div className="absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors duration-300 group-hover:text-ink">
          AKTÍVNE SÚDY
        </div>
      </div>
    </div>
  );
}
