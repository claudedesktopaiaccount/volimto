"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MiniPartyBar = {
  label: string;
  pct: number;
  color: string;
};

export type MiniSeatSlice = {
  color: string;
  seats: number;
};

function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

export function PredikciaMini({ bars, pollCount }: { bars: MiniPartyBar[]; pollCount: number }) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [hovered, setHovered] = useState(false);
  const [runId, setRunId] = useState(0);
  const [displayed, setDisplayed] = useState(() => bars.map(() => 0));

  useEffect(() => {
    if (!inView || bars.length === 0) return;
    const start = performance.now();
    const duration = 1600;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const jitter = t < 0.75 ? (Math.random() - 0.5) * 6 * (1 - t) : 0;
      setDisplayed(
        bars.map((b) => {
          const v = b.pct * eased + (b.pct > 0 ? jitter : 0);
          return Math.max(0, Math.min(100, v));
        })
      );
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplayed(bars.map((b) => b.pct));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bars, inView, runId]);

  return (
    <div
      ref={ref}
      className="flex items-center justify-center p-3"
      onMouseEnter={() => {
        setHovered(true);
        setDisplayed(bars.map(() => 0));
        setRunId((n) => n + 1);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-[205px] border border-ink/80 bg-card px-4 py-3 shadow-[3px_3px_0_rgba(17,17,16,0.08)]">
        <div className="mb-3 text-[10px] font-semibold tracking-[0.12em] text-muted">
          MONTE CARLO · {pollCount || "—"} PRIESKUMOV
        </div>
        {bars.length === 0 ? (
          <div className="py-8 text-center text-[11px] font-medium text-muted">
            Dáta nie sú dostupné
          </div>
        ) : (
          <div className="space-y-2.5">
            {bars.map((b, i) => {
              const winner = b.pct >= Math.max(...bars.map((bar) => bar.pct));
              return (
                <div key={b.label} className="flex items-center gap-2">
                  <span
                    className="shrink-0 rounded-full"
                    style={{
                      backgroundColor: b.color,
                      width: hovered && winner ? 14 : 12,
                      height: hovered && winner ? 14 : 12,
                      boxShadow:
                        hovered && winner
                          ? `0 0 0 3px color-mix(in srgb, ${b.color} 22%, white)`
                          : "none",
                      transition: "width 320ms ease, height 320ms ease, box-shadow 320ms ease",
                    }}
                  />
                  <span
                    className="w-10 shrink-0 tracking-[0.02em] text-ink"
                    style={{
                      fontSize: hovered && winner ? 11.5 : 11,
                      fontWeight: hovered && winner ? 700 : 500,
                      transition: "font-size 320ms ease, font-weight 320ms ease",
                    }}
                  >
                    {b.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden bg-subtle">
                    <div
                      className="h-full"
                      style={{
                        width: `${displayed[i] ?? 0}%`,
                        background: b.color,
                        transition: "width 80ms linear",
                      }}
                    />
                  </div>
                  <span
                    className="w-8 text-right tabular-nums text-ink"
                    style={{
                      fontSize: hovered && winner ? 12.5 : 11,
                      fontWeight: hovered && winner ? 800 : 700,
                      transition: "font-size 320ms ease, font-weight 320ms ease",
                    }}
                  >
                    {Math.round(displayed[i] ?? 0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function SimulatorMini({ seats }: { seats: MiniSeatSlice[] }) {
  const dotColours = useMemo(() => {
    const colours: string[] = [];
    for (const p of seats) {
      for (let i = 0; i < p.seats; i++) colours.push(p.color);
    }
    while (colours.length < 150) colours.push("#e8e3db");
    return colours.slice(0, 150);
  }, [seats]);

  const arcCounts = [15, 22, 28, 35, 50];
  const roundSvgCoord = (value: number) => Number(value.toFixed(4));
  const dots: { x: number; y: number; color: string; sortIdx: number }[] = [];
  let dotIndex = 0;
  arcCounts.forEach((count, arcIdx) => {
    const r = 26 + arcIdx * 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI - (i / (count - 1)) * Math.PI;
      dots.push({
        x: roundSvgCoord(80 + r * Math.cos(angle)),
        y: roundSvgCoord(72 - r * Math.sin(angle)),
        color: dotColours[dotIndex] ?? "#e8e3db",
        sortIdx: dotIndex,
      });
      dotIndex++;
    }
  });

  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [hovered, setHovered] = useState(false);
  const [runId, setRunId] = useState(0);
  const totalSeats = seats.reduce((s, p) => s + p.seats, 0);

  return (
    <div
      ref={ref}
      className="flex items-center justify-center p-3"
      onMouseEnter={() => {
        setHovered(true);
        setRunId((n) => n + 1);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-[205px] border border-ink/80 bg-card px-3 py-3 shadow-[3px_3px_0_rgba(17,17,16,0.08)]">
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold tracking-[0.12em] text-muted">
          <span>MANDÁTY</span>
          <span className="tabular-nums text-ink">{totalSeats}/150</span>
        </div>
        <svg
          key={runId}
          viewBox="0 0 160 84"
          width="100%"
          height="100"
          preserveAspectRatio="xMidYMid meet"
        >
          {dots.map((d, i) => {
            const delay = d.sortIdx * 8;
            return (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={2.5}
                fill={d.color}
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "scale(1)" : "scale(0.2)",
                  transformOrigin: `${d.x}px ${d.y}px`,
                  transition: `opacity 380ms ease ${delay}ms, transform 520ms cubic-bezier(0.2,0.9,0.2,1) ${delay}ms`,
                  animation: hovered
                    ? `simPulse 900ms cubic-bezier(0.2,0.9,0.2,1) ${d.sortIdx * 6}ms`
                    : "none",
                }}
              />
            );
          })}
          <line
            x1="20"
            y1="74"
            x2="140"
            y2="74"
            stroke="#111110"
            strokeWidth="0.4"
            strokeDasharray="2 2"
            opacity={inView ? 0.6 : 0}
            style={{ transition: "opacity 600ms ease 900ms" }}
          />
        </svg>
        <div className="mt-1 flex items-center justify-between text-[10px] tracking-[0.04em]">
          <span className="text-muted">väčšina 76</span>
          <span className="font-semibold tabular-nums text-[#1a6eb5]">
            z prieskumu
          </span>
        </div>
      </div>
      <style jsx>{`
        @keyframes simPulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.6);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export function PrieskumyMini({
  parties,
  date,
  agency,
}: {
  parties: MiniPartyBar[];
  date: string;
  agency: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const rowHeight = 17;
  const sortedLabels = [...parties]
    .sort((a, b) => b.pct - a.pct)
    .map((party) => party.label);
  const positions = new Map(
    parties.map((party, index) => [
      party.label,
      (isHovered ? sortedLabels.indexOf(party.label) : index) * rowHeight,
    ])
  );

  return (
    <div
      className="flex items-center justify-center p-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-[205px] border border-ink/80 bg-card px-4 py-3 shadow-[3px_3px_0_rgba(17,17,16,0.08)]">
        <div className="mb-3 truncate text-[10px] font-semibold tracking-[0.12em] text-muted">
          {agency} · {date}
        </div>
        {parties.length === 0 ? (
          <div className="py-8 text-center text-[11px] font-medium text-muted">
            Dáta nie sú dostupné
          </div>
        ) : (
          <div className="relative" style={{ height: parties.length * rowHeight }}>
            {parties.map((party) => {
              const sortedIndex = sortedLabels.indexOf(party.label);
              const isTopThree = sortedIndex < 3;
              const topThreeOffset = isHovered
                ? sortedIndex === 0
                  ? -2
                  : sortedIndex === 1
                    ? 0
                    : 1.5
                : 0;
              return (
                <div
                  key={party.label}
                  className="absolute left-0 right-0 flex items-center justify-between"
                  style={{
                    height: rowHeight,
                    transform: `translateY(${(positions.get(party.label) ?? 0) + topThreeOffset}px)`,
                    transition:
                      "transform 760ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 320ms ease, scale 760ms cubic-bezier(0.2, 0.9, 0.2, 1), filter 320ms ease",
                    opacity: isHovered && !isTopThree ? 0.62 : 1,
                    scale: isHovered && isTopThree ? "1.035" : "1",
                    filter:
                      isHovered && isTopThree
                        ? "drop-shadow(0 4px 10px rgba(17,17,16,0.12))"
                        : "none",
                    zIndex: isHovered ? parties.length - sortedIndex : parties.length,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full"
                      style={{
                        backgroundColor: party.color,
                        width: isHovered && isTopThree ? 14 : 12,
                        height: isHovered && isTopThree ? 14 : 12,
                        boxShadow:
                          isHovered && isTopThree
                            ? `0 0 0 3px color-mix(in srgb, ${party.color} 22%, white)`
                            : "none",
                        transition:
                          "width 320ms ease, height 320ms ease, box-shadow 320ms ease",
                      }}
                    />
                    <span
                      className="tracking-[0.02em] text-ink"
                      style={{
                        fontSize: isHovered && isTopThree ? 11.5 : 11,
                        fontWeight: isHovered && isTopThree ? 700 : 500,
                        transition: "font-size 320ms ease, font-weight 320ms ease",
                      }}
                    >
                      {party.label}
                    </span>
                  </div>
                  <span
                    className="tabular-nums text-ink"
                    style={{
                      fontSize: isHovered && isTopThree ? 12.5 : 11,
                      fontWeight: isHovered && isTopThree ? 800 : 700,
                      transition: "font-size 320ms ease, font-weight 320ms ease",
                    }}
                  >
                    {party.pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
