import PollStrip from "@/components/PollStrip";
import Link from "next/link";
import { getLatestPolls } from "@/lib/poll-data";
import { getDb } from "@/lib/db";
import { PredikciaMini, SimulatorMini, PrieskumyMini } from "@/components/home/FeaturePreviews";
import { buttonClasses } from "@/components/ui/Button";

export const revalidate = 3600;

export default async function Home() {
  const db = getDb();
  const pollData = await getLatestPolls(db).catch(() => ({
    parties: [],
    latestAgency: "—",
    latestDate: "—",
    pollCount: 0,
  }));

  const FEATURE_CARDS = [
    {
      href: "/predikcia",
      title: "Predikcia volieb",
      desc: "Monte Carlo simulácia na základe 42 prieskumov. Pravdepodobnosť výhry každej strany.",
      preview: <PredikciaMini />,
    },
    {
      href: "/koalicny-simulator",
      title: "Koaličný simulátor",
      desc: "Vyberte strany a zistite, či dokážu vytvoriť parlamentnú väčšinu.",
      preview: <SimulatorMini />,
    },
    {
      href: "/prieskumy",
      title: "Prieskumy",
      desc: "Vývoj volebných preferencií od júna 2025. Dáta z NMS, Focus, AKO, Ipsos.",
      preview: <PrieskumyMini />,
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
              className="group block bg-card overflow-hidden transition-colors duration-150 hover:bg-subtle"
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
              <div className="min-h-[100px] flex items-center justify-center bg-subtle border-b border-border">
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
