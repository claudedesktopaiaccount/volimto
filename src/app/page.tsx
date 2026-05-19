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
      <section className="max-w-content mx-auto px-6 py-12 md:py-16">
        <div className="feature-grid grid gap-px bg-border">
          {FEATURE_CARDS.map((card, i) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex h-full flex-col overflow-hidden bg-card transition-colors duration-150 hover:bg-subtle"
            >
              {/* Editorial header */}
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border">
                <span className="text-micro font-mono text-muted tabular-nums">
                  0{i + 1}
                </span>
                <span className="text-label text-muted">
                  {card.title}
                </span>
              </div>
              {/* Preview area */}
              <div className="flex h-[248px] shrink-0 items-center justify-center border-b border-border bg-subtle">
                {card.preview}
              </div>
              {/* Content */}
              <div className="p-5">
                <h3 className="mb-1.5 text-base font-bold text-ink">
                  {card.title}
                </h3>
                <p className="mb-4 text-xs leading-relaxed text-secondary">
                  {card.desc}
                </p>
                <span className="text-xs font-semibold text-ink group-hover:underline">
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
