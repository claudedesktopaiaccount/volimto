import type { LegislationRow, AmendmentRow } from "@/lib/db/mps";

interface Props {
  legislation: LegislationRow[];
  amendments: AmendmentRow[];
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)}. ${parseInt(m, 10)}. ${y}`;
}

export default function LegislationTab({ legislation, amendments }: Props) {
  if (legislation.length === 0 && amendments.length === 0) {
    return (
      <div className="border border-border bg-card p-6 text-sm text-muted">
        Tento poslanec zatiaľ nepredložil žiadnu legislatívu ani pozmeňujúce
        návrhy v aktuálnom volebnom období.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-bold text-ink uppercase tracking-wide mb-3 font-mono">
          Legislatívna iniciatíva
          <span className="ml-2 text-muted font-normal">
            ({legislation.length})
          </span>
        </h2>

        {legislation.length === 0 ? (
          <p className="text-sm text-muted px-1 py-2">
            Žiadna predložená legislatíva.
          </p>
        ) : (
          <ul className="border border-border bg-card divide-y divide-border">
            {legislation.map((l) => (
              <li key={l.id} className="p-3 flex flex-col sm:flex-row gap-2 sm:gap-4">
                <span className="text-xs font-mono text-muted shrink-0 sm:w-24">
                  {fmtDate(l.date)}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-ink hover:underline"
                  >
                    {l.title}
                  </a>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs font-mono text-muted">
                    {l.cisloTlace && <span>ČPT {l.cisloTlace}</span>}
                    {l.status && <span>{l.status}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold text-ink uppercase tracking-wide mb-3 font-mono">
          Pozmeňujúce návrhy
          <span className="ml-2 text-muted font-normal">
            ({amendments.length})
          </span>
        </h2>

        {amendments.length === 0 ? (
          <p className="text-sm text-muted px-1 py-2">
            Žiadne pozmeňujúce návrhy.
          </p>
        ) : (
          <ul className="border border-border bg-card divide-y divide-border">
            {amendments.map((a) => (
              <li key={a.id} className="p-3 flex flex-col sm:flex-row gap-2 sm:gap-4">
                <span className="text-xs font-mono text-muted shrink-0 sm:w-24">
                  {fmtDate(a.date)}
                </span>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-ink hover:underline min-w-0"
                >
                  {a.toLaw}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
