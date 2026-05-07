"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";

interface Party {
  id: string;
  name: string;
  abbreviation: string;
}

interface MpFiltersProps {
  parties: Party[];
}

export default function MpFilters({ parties }: MpFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val) {
          params.set(key, val);
        } else {
          params.delete(key);
        }
      }
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const currentParty = searchParams.get("party") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const currentView = searchParams.get("view") ?? "grouped";
  const [inputValue, setInputValue] = useState(currentSearch);

  const handlePartyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value || null;
      // Selecting a single party forces flat view; clearing returns to grouped
      pushParams({ party: val, view: val ? "flat" : null });
    },
    [pushParams]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Search forces flat view (so matches across all parties show in one list)
        pushParams({ search: value || null, view: value ? "flat" : null });
      }, 300);
    },
    [pushParams]
  );

  const setView = useCallback(
    (view: "grouped" | "flat") => {
      pushParams({ view: view === "grouped" ? null : "flat" });
    },
    [pushParams]
  );

  return (
    <div className="flex flex-wrap gap-2 mb-6 items-center">
      <select
        value={currentParty}
        onChange={handlePartyChange}
        className="border border-border bg-surface text-sm px-3 py-2 text-ink"
      >
        <option value="">Všetky strany</option>
        {parties.map((p) => (
          <option key={p.id} value={p.abbreviation}>
            {p.abbreviation} — {p.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Hľadať poslanca..."
        value={inputValue}
        onChange={handleSearchChange}
        className="border border-border bg-surface text-sm px-3 py-2 text-ink placeholder:text-muted min-w-[200px]"
      />

      <div className="ml-auto inline-flex border border-border">
        <button
          type="button"
          onClick={() => setView("grouped")}
          className={`px-3 py-2 text-xs font-mono uppercase tracking-wide ${
            currentView === "grouped"
              ? "bg-ink text-card"
              : "bg-surface text-ink hover:bg-hover"
          }`}
        >
          Podľa strán
        </button>
        <button
          type="button"
          onClick={() => setView("flat")}
          className={`px-3 py-2 text-xs font-mono uppercase tracking-wide border-l border-border ${
            currentView === "flat"
              ? "bg-ink text-card"
              : "bg-surface text-ink hover:bg-hover"
          }`}
        >
          Všetci
        </button>
      </div>
    </div>
  );
}
