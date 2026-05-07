import Link from "next/link";
import type { SpeechRow, InterpellationRow, QuestionRow } from "@/lib/db/mps";

type Sub = "reci" | "interpelacie" | "otazky";

interface Props {
  activeSub: Sub;
  mpSlug: string;
  page: number;
  speeches: SpeechRow[] | null;
  speechesTotal: number;
  interpellations: InterpellationRow[] | null;
  interpellationsTotal: number;
  questions: QuestionRow[] | null;
  questionsTotal: number;
}

const SUB_LABELS: Record<Sub, string> = {
  reci: "Reči",
  interpelacie: "Interpelácie",
  otazky: "Otázky",
};

export default function SpeechesTab({
  activeSub,
  mpSlug,
  page,
  speeches,
  speechesTotal,
  interpellations,
  interpellationsTotal,
  questions,
  questionsTotal,
}: Props) {
  const total =
    activeSub === "reci"
      ? speechesTotal
      : activeSub === "interpelacie"
        ? interpellationsTotal
        : questionsTotal;
  const totalPages = Math.ceil(total / (activeSub === "reci" ? 10 : 20));

  function pageHref(p: number) {
    return `/poslanci/${mpSlug}?tab=reci&sub=${activeSub}&page=${p}`;
  }

  function subHref(s: Sub) {
    return `/poslanci/${mpSlug}?tab=reci&sub=${s}`;
  }

  return (
    <div>
      {/* Sub-toggle */}
      <div className="flex border-b border-border mb-4">
        {(Object.keys(SUB_LABELS) as Sub[]).map((s) => {
          const isActive = s === activeSub;
          return (
            <Link
              key={s}
              href={subHref(s)}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wide border-b-2 ${
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {SUB_LABELS[s]}
            </Link>
          );
        })}
      </div>

      <p className="text-xs font-mono text-muted mb-3">
        {total === 0
          ? `Žiadne ${SUB_LABELS[activeSub].toLowerCase()}`
          : `Celkom ${total}`}
      </p>

      {activeSub === "reci" && (
        <SpeechList speeches={speeches ?? []} />
      )}
      {activeSub === "interpelacie" && (
        <InterpellationList rows={interpellations ?? []} />
      )}
      {activeSub === "otazky" && (
        <QuestionList rows={questions ?? []} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-4 mt-6">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-hover">
              ← Predchádzajúca
            </Link>
          ) : (
            <span className="border border-border bg-surface px-4 py-2 text-sm text-muted opacity-40 cursor-not-allowed">
              ← Predchádzajúca
            </span>
          )}
          <span className="text-xs font-mono text-muted">{page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-hover">
              Ďalšia →
            </Link>
          ) : (
            <span className="border border-border bg-surface px-4 py-2 text-sm text-muted opacity-40 cursor-not-allowed">
              Ďalšia →
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SpeechList({ speeches }: { speeches: SpeechRow[] }) {
  if (speeches.length === 0) {
    return (
      <div className="border border-border bg-card p-8 text-center text-muted text-sm">
        Žiadne záznamy o rečiach.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0">
      {speeches.map((s) => (
        <div key={s.id} className="border-b border-divider py-4 hover:bg-hover px-1">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-xs font-mono text-muted shrink-0">{s.date}</span>
            <span className="text-sm font-medium text-ink">
              {s.titleSk ?? "Prejav"}
            </span>
          </div>
          {s.excerpt && (
            <p className="text-sm text-text leading-relaxed mt-1 line-clamp-3">
              {s.excerpt}
              {s.excerpt.length >= 300 && (
                <span className="text-muted ml-1 text-xs">… (skrátené)</span>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function InterpellationList({ rows }: { rows: InterpellationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border border-border bg-card p-8 text-center text-muted text-sm">
        Žiadne interpelácie.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0">
      {rows.map((r) => (
        <div key={r.id} className="border-b border-divider py-4 hover:bg-hover px-1">
          <div className="flex items-baseline gap-3 mb-1 flex-wrap">
            <span className="text-xs font-mono text-muted shrink-0">{r.date}</span>
            {r.addressee && (
              <span className="text-xs font-mono text-muted">→ {r.addressee}</span>
            )}
            {r.answerUrl && (
              <a href={r.answerUrl} target="_blank" rel="noopener" className="text-xs font-mono text-accent hover:underline">
                Odpoveď
              </a>
            )}
          </div>
          <a href={r.url} target="_blank" rel="noopener" className="text-sm font-medium text-ink hover:underline">
            {r.subject}
          </a>
        </div>
      ))}
    </div>
  );
}

function QuestionList({ rows }: { rows: QuestionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border border-border bg-card p-8 text-center text-muted text-sm">
        Žiadne otázky.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0">
      {rows.map((r) => (
        <div key={r.id} className="border-b border-divider py-4 hover:bg-hover px-1">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-xs font-mono text-muted shrink-0">{r.date}</span>
          </div>
          <a href={r.url} target="_blank" rel="noopener" className="text-sm font-medium text-ink hover:underline">
            {r.subject}
          </a>
        </div>
      ))}
    </div>
  );
}
