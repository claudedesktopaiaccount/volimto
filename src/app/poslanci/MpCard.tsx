import Link from "next/link";
import type { MpRow } from "@/lib/db/mps";

interface Props {
  mp: MpRow;
  /** Compact: smaller portrait, omit party chip (used inside party sections). */
  compact?: boolean;
}

export function MpCard({ mp, compact = false }: Props) {
  const initial = mp.nameDisplay.charAt(0).toUpperCase();
  const isMinister = /minister|predseda vl[aá]dy/i.test(mp.role);
  const portrait = compact ? "w-12 h-12" : "w-12 h-12";

  return (
    <div className="bg-card border border-border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className={`${portrait} shrink-0 bg-surface border border-border flex items-center justify-center text-muted font-mono text-sm font-bold overflow-hidden`}
          aria-hidden
        >
          {mp.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mp.photoUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover object-top"
            />
          ) : (
            initial
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <Link
            href={`/poslanci/${mp.slug}`}
            className="font-medium text-sm text-ink hover:underline leading-tight block truncate"
          >
            {mp.nameDisplay}
          </Link>

          <div className="flex items-center gap-1 flex-wrap leading-none">
            {!compact && mp.partyAbbr && (
              <span
                className="inline-block px-1.5 py-0.5 text-[10px] font-bold text-white leading-none"
                style={{ backgroundColor: mp.partyColor ?? "#555" }}
              >
                {mp.partyAbbr}
              </span>
            )}
            {isMinister && (
              <span className="inline-block px-1 py-0.5 text-[9px] font-bold text-black bg-yellow-300 leading-none uppercase tracking-wide">
                Minister
              </span>
            )}
          </div>
        </div>
      </div>

      {!compact && mp.constituency && (
        <p className="text-xs text-muted truncate">{mp.constituency}</p>
      )}
      {!compact && mp.role && mp.role !== "poslanec" && (
        <p className="text-xs text-muted font-mono truncate">{mp.role}</p>
      )}
    </div>
  );
}
