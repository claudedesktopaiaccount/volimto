"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { value: "hlasovanie", label: "Hlasovanie" },
  { value: "reci", label: "Reči" },
  { value: "predlozene", label: "Čo predložil/a" },
  { value: "firmy", label: "Firmy" },
  { value: "zmluvy", label: "Zmluvy" },
] as const;

interface Props {
  activeTab: string;
  mpSlug: string;
}

export default function MpTabs({ activeTab, mpSlug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabClick(tab: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    p.delete("page");
    router.push(`/poslanci/${mpSlug}?${p.toString()}`);
  }

  return (
    <div className="border-b border-border mb-6 overflow-x-auto">
      <div className="flex min-w-max">
        {TABS.map((t) => {
          const isActive = activeTab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => handleTabClick(t.value)}
              className={[
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-none",
                isActive
                  ? "border-ink text-ink font-bold"
                  : "border-transparent text-muted hover:text-ink hover:border-border",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
