"use client";

import { useEffect, useMemo, useState } from "react";
import type { MpRow } from "@/lib/db/mps";
import type { GroupedMps } from "@/lib/db/mps-grouped";
import { CoalitionBlock } from "./CoalitionBlock";
import { MpCard } from "./MpCard";

interface Party {
  id: string;
  name: string;
  abbreviation: string;
}

interface MpsBrowserProps {
  parties: Party[];
  groupedMps: GroupedMps;
}

const SEARCH_DEBOUNCE_MS = 180;

export default function MpsBrowser({
  parties,
  groupedMps,
}: MpsBrowserProps) {
  const [party, setParty] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grouped" | "flat">("grouped");
  const [urlReady, setUrlReady] = useState(false);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const activeView = party || search.trim() ? "flat" : view;

  const allMps = useMemo(
    () => [
      ...groupedMps.coalition.flatMap((group) => group.mps),
      ...groupedMps.opposition.flatMap((group) => group.mps),
      ...groupedMps.independent,
    ],
    [groupedMps]
  );

  const filteredMps = useMemo(
    () => filterMps(allMps, party, debouncedSearch),
    [allMps, party, debouncedSearch]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const urlParty = params.get("party") ?? "";
      const urlSearch = params.get("search") ?? "";
      const urlView =
        urlParty || urlSearch ? "flat" : params.get("view") === "flat" ? "flat" : "grouped";

      setParty(urlParty);
      setSearch(urlSearch);
      setView(urlView);
      setUrlReady(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!urlReady) return;

    const params = new URLSearchParams(window.location.search);

    if (party) {
      params.set("party", party);
    } else {
      params.delete("party");
    }

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    } else {
      params.delete("search");
    }

    if (party || debouncedSearch.trim()) {
      params.set("view", "flat");
    } else if (view === "flat") {
      params.set("view", "flat");
    } else {
      params.delete("view");
    }

    params.delete("page");
    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [party, debouncedSearch, urlReady, view]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <select
          value={party}
          onChange={(event) => setParty(event.target.value)}
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
          type="search"
          placeholder="Hľadať poslanca..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="border border-border bg-surface text-sm px-3 py-2 text-ink placeholder:text-muted min-w-[200px]"
        />

        <div className="ml-auto inline-flex border border-border">
          <button
            type="button"
            onClick={() => setView("grouped")}
            className={`px-3 py-2 text-xs font-mono uppercase tracking-wide ${
              activeView === "grouped"
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
              activeView === "flat"
                ? "bg-ink text-card"
                : "bg-surface text-ink hover:bg-hover"
            }`}
          >
            Všetci
          </button>
        </div>
      </div>

      {activeView === "grouped" ? (
        <GroupedView groupedMps={groupedMps} />
      ) : (
        <FlatView mps={filteredMps} />
      )}
    </>
  );
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function GroupedView({ groupedMps }: { groupedMps: GroupedMps }) {
  return (
    <>
      <CoalitionBlock label="Vládna koalícia" groups={groupedMps.coalition} inverted />
      <CoalitionBlock label="Opozícia" groups={groupedMps.opposition} />
      {groupedMps.independent.length > 0 && (
        <div className="mb-8">
          <div className="flex items-baseline justify-between px-4 py-3 mb-3 bg-card text-ink border border-border">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] font-mono">
              Nezaradení
            </h2>
            <span className="text-xs font-mono">{groupedMps.independent.length}</span>
          </div>
          <div className="border border-border bg-card p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {groupedMps.independent.map((mp) => (
              <MpCard key={mp.id} mp={mp} compact />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FlatView({ mps }: { mps: MpRow[] }) {
  return (
    <>
      <p className="text-xs text-muted font-mono mb-4">
        {mps.length === 0 ? "Žiadni poslanci" : `Zobrazených ${mps.length} poslancov`}
      </p>

      {mps.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-muted text-sm">
          Žiadni poslanci nevyhovujú filtrom.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {mps.map((mp) => (
            <MpCard key={mp.id} mp={mp} />
          ))}
        </div>
      )}
    </>
  );
}

function filterMps(mps: MpRow[], party: string, search: string): MpRow[] {
  const terms = normalize(search)
    .split(/\s+/)
    .filter(Boolean);

  return mps.filter((mp) => {
    if (party && mp.partyAbbr !== party) return false;
    if (terms.length === 0) return true;

    const haystack = normalize(
      [
        mp.nameDisplay,
        mp.nameFull,
        mp.slug,
        mp.partyAbbr,
        mp.constituency,
        mp.role,
      ]
        .filter(Boolean)
        .join(" ")
    );

    return terms.every((term) => haystack.includes(term));
  });
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
