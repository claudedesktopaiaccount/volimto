import Link from "next/link";
import type { SpeechRow, InterpellationRow, QuestionRow } from "@/lib/db/mps";
import { fallbackSpeechDigest, parseKeyPoints, speechMeta } from "@/lib/speech-digest";

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
      <div className="mb-4 flex border-b border-border">
        {(Object.keys(SUB_LABELS) as Sub[]).map((s) => {
          const isActive = s === activeSub;
          return (
            <Link
              key={s}
              href={subHref(s)}
              className={`border-b-2 px-4 py-2 text-xs font-mono uppercase tracking-wide ${
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

      <p className="mb-3 text-xs font-mono text-muted">
        {total === 0
          ? `Žiadne ${SUB_LABELS[activeSub].toLowerCase()}`
          : `Celkom ${total}`}
      </p>

      {activeSub === "reci" && <SpeechList speeches={speeches ?? []} />}
      {activeSub === "interpelacie" && (
        <InterpellationList rows={interpellations ?? []} />
      )}
      {activeSub === "otazky" && <QuestionList rows={questions ?? []} />}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center gap-4">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-hover"
            >
              ← Predchádzajúca
            </Link>
          ) : (
            <span className="cursor-not-allowed border border-border bg-surface px-4 py-2 text-sm text-muted opacity-40">
              ← Predchádzajúca
            </span>
          )}
          <span className="text-xs font-mono text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-hover"
            >
              Ďalšia →
            </Link>
          ) : (
            <span className="cursor-not-allowed border border-border bg-surface px-4 py-2 text-sm text-muted opacity-40">
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
      <div className="border border-border bg-card p-8 text-center text-sm text-muted">
        Žiadne záznamy o rečiach.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {speeches.map((speech) => {
        const input = {
          titleSk: speech.titleSk,
          textSk: speech.textSk,
          date: speech.date,
        };
        const fallback = fallbackSpeechDigest(input);
        const meta = speechMeta(input);
        const keyPoints = parseKeyPoints(speech.keyPointsSk);
        const title = speech.cleanTitleSk ?? fallback.cleanTitleSk;
        const type = speech.speechType ?? meta.speechType;
        const summary = speech.summarySk ?? fallback.summarySk;
        const points = (keyPoints.length > 0 ? keyPoints : fallback.keyPointsSk).filter(
          (point) => point !== summary
        );

        return (
          <article key={speech.id} className="border border-border bg-card p-4">
            <h3 className="text-base font-semibold leading-snug text-ink">
              {title}
            </h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-muted">
              <span>{speech.date}</span>
              {meta.timeRange && <span>{meta.timeRange}</span>}
              {meta.sessionLabel && <span>{meta.sessionLabel}</span>}
              <span>{type}</span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-text">
              {summary}
            </p>

            {points.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-mono uppercase tracking-wide text-muted">
                  Čo povedal/a
                </p>
                <ul className="space-y-1 text-sm text-text">
                  {points.slice(0, 3).map((point) => (
                    <li key={point} className="leading-relaxed">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {speech.sourceUrl && (
              <a
                href={speech.sourceUrl}
                target="_blank"
                rel="noopener"
                className="mt-3 inline-block text-xs font-mono text-accent hover:underline"
              >
                Zdroj NR SR
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}

function InterpellationList({ rows }: { rows: InterpellationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border border-border bg-card p-8 text-center text-sm text-muted">
        Žiadne interpelácie.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0">
      {rows.map((r) => (
        <div key={r.id} className="border-b border-divider px-1 py-4 hover:bg-hover">
          <div className="mb-1 flex flex-wrap items-baseline gap-3">
            <span className="shrink-0 text-xs font-mono text-muted">{r.date}</span>
            {r.addressee && (
              <span className="text-xs font-mono text-muted">→ {r.addressee}</span>
            )}
            {r.answerUrl && (
              <a
                href={r.answerUrl}
                target="_blank"
                rel="noopener"
                className="text-xs font-mono text-accent hover:underline"
              >
                Odpoveď
              </a>
            )}
          </div>
          <a
            href={r.url}
            target="_blank"
            rel="noopener"
            className="text-sm font-medium text-ink hover:underline"
          >
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
      <div className="border border-border bg-card p-8 text-center text-sm text-muted">
        Žiadne otázky.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0">
      {rows.map((r) => (
        <div key={r.id} className="border-b border-divider px-1 py-4 hover:bg-hover">
          <div className="mb-1 flex items-baseline gap-3">
            <span className="shrink-0 text-xs font-mono text-muted">{r.date}</span>
          </div>
          <a
            href={r.url}
            target="_blank"
            rel="noopener"
            className="text-sm font-medium text-ink hover:underline"
          >
            {r.subject}
          </a>
        </div>
      ))}
    </div>
  );
}
