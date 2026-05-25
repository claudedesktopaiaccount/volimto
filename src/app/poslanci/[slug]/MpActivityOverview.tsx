import Link from "next/link";
import type { ReactNode } from "react";
import type { MpDetailOverview } from "@/lib/db/mps";
import { fallbackSpeechDigest } from "@/lib/speech-digest";

const money = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface Props {
  overview: MpDetailOverview;
  mpSlug: string;
}

export default function MpActivityOverview({ overview, mpSlug }: Props) {
  return (
    <section className="mb-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewBlock
          title="Reči"
          count={overview.speechTotal}
          emptyText="Žiadne evidované reči"
          href={`/poslanci/${mpSlug}?tab=reci`}
        >
          <LatestList
            items={overview.speeches.map((speech) => {
              const fallback = fallbackSpeechDigest({
                titleSk: speech.titleSk,
                textSk: speech.textSk,
                date: speech.date,
              });
              return {
                id: speech.id,
                date: speech.date,
                label: speech.cleanTitleSk ?? fallback.cleanTitleSk,
                description: speech.summarySk ?? fallback.summarySk,
              };
            })}
          />
        </OverviewBlock>

        <OverviewBlock
          title="Interpelácie"
          count={overview.interpellationTotal}
          emptyText="Žiadne evidované interpelácie"
          href={`/poslanci/${mpSlug}?tab=reci&sub=interpelacie`}
        >
          <LatestList
            items={overview.interpellations.map((item) => ({
              id: item.id,
              date: item.date,
              label: item.subject,
            }))}
          />
        </OverviewBlock>

        <OverviewBlock
          title="Firmy"
          count={overview.companies.length}
          emptyText="Žiadne overené prepojenia"
          href={`/poslanci/${mpSlug}?tab=firmy`}
        >
          <LatestList
            items={overview.companies.slice(0, 3).map((company) => ({
              id: company.id,
              date: company.relationship,
              label: company.name,
            }))}
          />
        </OverviewBlock>

        <OverviewBlock
          title="Zmluvy"
          count={overview.contractTotal}
          emptyText="Žiadne overené zmluvy"
          href={`/poslanci/${mpSlug}?tab=zmluvy`}
          meta={
            overview.contractTotal > 0
              ? `Hodnota ${money.format(overview.contractTotalAmount)}`
              : undefined
          }
        >
          <LatestList
            items={overview.contractPreview.map((contract) => ({
              id: contract.id,
              date: contract.signedDate,
              label: contract.titleSk,
            }))}
          />
        </OverviewBlock>
      </div>
    </section>
  );
}

function OverviewBlock({
  title,
  count,
  emptyText,
  href,
  meta,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  href: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-44 flex-col border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <span className="text-xs font-mono text-muted">{count}</span>
      </div>
      {meta && <p className="mt-1 text-xs font-mono text-muted">{meta}</p>}

      <div className="mt-3 grow">
        {count === 0 ? (
          <p className="text-sm leading-relaxed text-muted">{emptyText}</p>
        ) : (
          children
        )}
      </div>

      <Link
        href={href}
        className="mt-4 text-xs font-mono text-accent hover:underline"
      >
        Zobraziť detail
      </Link>
    </div>
  );
}

function LatestList({
  items,
}: {
  items: { id: number; date: string; label: string; description?: string }[];
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <p className="text-[11px] font-mono text-muted">{item.date}</p>
          <p className="line-clamp-2 text-sm leading-snug text-ink">{item.label}</p>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">
              {item.description}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
