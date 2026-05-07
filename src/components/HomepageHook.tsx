import Link from "next/link";
import type { LatestPollData } from "@/lib/poll-data";
import { PARTIES } from "@/lib/parties";

interface HomepageHookProps {
  topParties: LatestPollData[];
}

export default function HomepageHook({ topParties }: HomepageHookProps) {
  return (
    <div>
      {/* Hero CTA */}
      <section className="py-16 sm:py-24 text-center max-w-xl mx-auto px-4">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-3">
          Kde stojíš v&nbsp;slovenskej politike?
        </h1>
        <p className="text-sm text-text/60 mb-8 max-w-sm mx-auto">
          20 otázok. 2 minúty. Zisti, ktoré strany zastupujú tvoje hodnoty.
        </p>
        <Link
          href="/volebny-kalkulator"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
          className="inline-block px-8 py-3 font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Spustiť kalkulačku →
        </Link>
        <p className="micro-label mt-16">Slovenské voľby 2026</p>
      </section>

      {/* Teaser poll strip */}
      <section className="border-t border-divider py-4 px-4">
        <p className="micro-label mb-3 text-center">Aktuálne prieskumy</p>
        <div className="flex justify-center gap-6 sm:gap-8">
          {topParties.slice(0, 5).map((p) => (
            <div key={p.partyId} className="text-center">
              <div
                className="w-9 h-9 mx-auto mb-1 flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: PARTIES[p.partyId]?.color ?? p.color }}
              >
                {p.abbreviation}
              </div>
              <div className="data-value font-bold text-sm">{p.percentage.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* Skip link */}
      <div className="text-center py-4 border-t border-divider">
        <span className="text-xs text-text/40">Alebo </span>
        <Link href="/?dashboard=1" className="text-xs text-info underline">
          zobraziť plný dashboard →
        </Link>
      </div>
    </div>
  );
}
