"use client";

import { PARTIES } from "@/lib/parties";

interface HemicycleProps {
  seats: { partyId: string; seats: number }[];
  selectedParties: Set<string>;
}

export default function Hemicycle({ seats, selectedParties }: HemicycleProps) {
  const sorted = [...seats].sort((a, b) => b.seats - a.seats);
  const totalSeats = 150;

  // Build flat array of dots ordered by party
  const dots: { partyId: string; color: string; selected: boolean }[] = [];
  for (const s of sorted) {
    const party = PARTIES[s.partyId];
    for (let i = 0; i < s.seats; i++) {
      dots.push({
        partyId: s.partyId,
        color: party?.color ?? "#ccc",
        selected: selectedParties.has(s.partyId),
      });
    }
  }
  while (dots.length < totalSeats) {
    dots.push({ partyId: "empty", color: "var(--divider)", selected: false });
  }

  // Arrange dots in a hemicycle (semicircle rows)
  // 5 rows: 20, 25, 30, 35, 40 = 150
  const rows = [20, 25, 30, 35, 40];
  let dotIndex = 0;

  const cx = 200;
  const cy = 195;
  const minR = 60;
  const maxR = 180;

  const svgDots: { x: number; y: number; color: string; selected: boolean; partyId: string }[] = [];
  const round = (value: number) => Math.round(value * 1000) / 1000;

  for (let row = 0; row < rows.length; row++) {
    const count = rows[row];
    const r = minR + ((maxR - minR) * row) / (rows.length - 1);

    for (let i = 0; i < count; i++) {
      const angle = Math.PI - (Math.PI * (i + 0.5)) / count;
      const x = cx + r * Math.cos(angle);
      const y = cy - r * Math.sin(angle);
      const dot = dots[dotIndex++];
      svgDots.push({ x: round(x), y: round(y), ...dot });
    }
  }

  return (
    <svg viewBox="0 0 400 220" className="w-full max-w-md mx-auto">
      {svgDots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={6}
          fill={dot.color}
          opacity={dot.selected ? 1 : selectedParties.size > 0 ? 0.25 : 0.8}
          className="transition-opacity duration-200"
        />
      ))}
      {/* Majority line (76th seat) - vertical center line */}
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - maxR - 10}
        stroke="var(--ink)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text
        x={cx}
        y={cy - maxR - 14}
        textAnchor="middle"
        fontSize={9}
        fill="var(--text)"
        fontWeight={500}
      >
        76
      </text>
    </svg>
  );
}
