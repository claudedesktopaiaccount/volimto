"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  OpendataFilters as Filters,
  OpendataView,
} from "@/lib/opendata-dashboard";
import type { OpendataPartyOption } from "@/lib/db/opendata-analytics";

interface OpendataFiltersProps {
  filters: Filters;
  years: string[];
  parties: OpendataPartyOption[];
  legalForms: string[];
}

const fieldClass =
  "min-h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

export default function OpendataFilters({
  filters,
  years,
  parties,
  legalForms,
}: OpendataFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.query);
  const [isPending, startTransition] = useTransition();
  const isCompanyView = filters.view === "companies";

  function update(values: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");

    const query = params.toString();
    startTransition(() => {
      router.replace(`/opendata${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ q: search.trim() });
  }

  function reset() {
    setSearch("");
    const view = filters.view === "overview" ? "" : filters.view;
    const params = new URLSearchParams();
    if (view) params.set("view", view);

    startTransition(() => {
      router.replace(`/opendata${params.size ? `?${params}` : ""}`, {
        scroll: false,
      });
    });
  }

  const chips = activeChips(filters, parties);
  const hasActiveFilters = isCompanyView
    ? Boolean(filters.query || filters.legalForm || filters.companySort !== "contracts")
    : chips.length > 0 || filters.sort !== "newest";

  return (
    <section
      aria-label="Filtre otvorených dát"
      aria-busy={isPending}
      className="mb-6 rounded-panel border border-border bg-card p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">Filtrovať importované dáta</p>
          <p className="mt-0.5 text-xs text-muted">
            Súhrny, grafy aj rebríčky sa prepočítajú podľa výberu.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-xs text-muted">
            {isPending ? "Aktualizujem…" : ""}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Zrušiť filtre
            </button>
          )}
        </div>
      </div>

      <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <label className={isCompanyView ? "sm:col-span-2 lg:col-span-6" : "sm:col-span-2 lg:col-span-4"}>
          <span className="mb-1 block text-label text-muted">HĽADAŤ</span>
          <span className="flex">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isCompanyView
                  ? "Názov firmy, IČO alebo právna forma"
                  : "Predmet, dodávateľ, IČO alebo objednávateľ"
              }
              className={`${fieldClass} rounded-r-none`}
            />
            <button
              type="submit"
              className="rounded-r-md border border-l-0 border-ink bg-ink px-4 text-sm font-semibold text-paper hover:opacity-90"
            >
              Hľadať
            </button>
          </span>
        </label>

        {isCompanyView ? (
          <>
            <FilterSelect
              label="PRÁVNA FORMA"
              value={filters.legalForm}
              onChange={(value) => update({ form: value })}
              className="lg:col-span-3"
            >
              <option value="">Všetky právne formy</option>
              {legalForms.map((legalForm) => (
                <option key={legalForm} value={legalForm}>
                  {legalForm}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="ZORADIŤ"
              value={filters.companySort}
              onChange={(value) => update({ companySort: value })}
              className="lg:col-span-3"
            >
              <option value="contracts">Podľa hodnoty zmlúv</option>
              <option value="name">Podľa názvu</option>
            </FilterSelect>
          </>
        ) : (
          <ContractFilters
            filters={filters}
            years={years}
            parties={parties}
            update={update}
          />
        )}
      </form>

      {chips.length > 0 && !isCompanyView && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-divider pt-3">
          <span className="text-xs text-muted">Aktívne:</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => update({ [chip.key]: "" })}
              className="inline-flex items-center gap-1 rounded-pill border border-accent-border bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent"
              aria-label={`Odstrániť filter ${chip.label}`}
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ContractFilters({
  filters,
  years,
  parties,
  update,
}: {
  filters: Filters;
  years: string[];
  parties: OpendataPartyOption[];
  update: (values: Record<string, string>) => void;
}) {
  return (
    <>
      <FilterSelect
        label="ROK"
        value={filters.year}
        onChange={(value) => update({ year: value })}
        className="lg:col-span-2"
      >
        <option value="">Všetky roky</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="HODNOTA"
        value={filters.amount}
        onChange={(value) => update({ amount: value })}
        className="lg:col-span-2"
      >
        <option value="all">Akákoľvek</option>
        <option value="known">Len s hodnotou</option>
        <option value="zero">0 € alebo neuvedené</option>
        <option value="10k">Od 10 000 €</option>
        <option value="100k">Od 100 000 €</option>
        <option value="1m">Od 1 mil. €</option>
      </FilterSelect>

      <FilterSelect
        label="DODÁVATEĽ V RPVS"
        value={filters.rpvs}
        onChange={(value) => update({ rpvs: value })}
        className="lg:col-span-2"
      >
        <option value="all">Všetci</option>
        <option value="in-rpvs">Nájdený v importe</option>
        <option value="not-in-rpvs">Nenájdený v importe</option>
      </FilterSelect>

      <FilterSelect
        label="POLITICKÁ VÄZBA"
        value={filters.link}
        onChange={(value) => update({ link: value })}
        className="lg:col-span-2"
      >
        <option value="all">Všetky zmluvy</option>
        <option value="linked">Len overené väzby</option>
        <option value="unlinked">Bez overenej väzby</option>
      </FilterSelect>

      <FilterSelect
        label="SÚČASNÁ STRANA"
        value={filters.partyId}
        onChange={(value) => update({ party: value })}
        className="lg:col-span-2"
        disabled={parties.length === 0}
      >
        <option value="">
          {parties.length === 0 ? "Žiadne overené priradenia" : "Všetky strany"}
        </option>
        {parties.map((party) => (
          <option key={party.id} value={party.id}>
            {party.abbreviation} — {party.name}
          </option>
        ))}
      </FilterSelect>

      {filters.view === "contracts" && (
        <FilterSelect
          label="ZORADIŤ"
          value={filters.sort}
          onChange={(value) => update({ sort: value })}
          className="lg:col-span-2"
        >
          <option value="newest">Najnovšie</option>
          <option value="oldest">Najstaršie</option>
          <option value="highest">Najvyššia hodnota</option>
          <option value="lowest">Najnižšia hodnota</option>
        </FilterSelect>
      )}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  className,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-label text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted`}
      >
        {children}
      </select>
    </label>
  );
}

function activeChips(filters: Filters, parties: OpendataPartyOption[]) {
  const chips: Array<{ key: string; label: string }> = [];
  if (filters.query) chips.push({ key: "q", label: `„${filters.query}“` });
  if (filters.year) chips.push({ key: "year", label: `Rok ${filters.year}` });
  if (filters.amount !== "all") {
    const labels: Record<string, string> = {
      known: "Len s hodnotou",
      zero: "0 € alebo neuvedené",
      "10k": "Od 10 000 €",
      "100k": "Od 100 000 €",
      "1m": "Od 1 mil. €",
    };
    chips.push({ key: "amount", label: labels[filters.amount] });
  }
  if (filters.rpvs !== "all") {
    chips.push({
      key: "rpvs",
      label: filters.rpvs === "in-rpvs" ? "Nájdený v RPVS importe" : "Mimo RPVS importu",
    });
  }
  if (filters.link !== "all") {
    chips.push({
      key: "link",
      label: filters.link === "linked" ? "Overená politická väzba" : "Bez overenej väzby",
    });
  }
  if (filters.partyId) {
    const party = parties.find((item) => item.id === filters.partyId);
    chips.push({ key: "party", label: party?.abbreviation ?? filters.partyId });
  }
  return chips;
}

export function viewLabel(view: OpendataView): string {
  switch (view) {
    case "contracts":
      return "Zmluvy CRZ";
    case "companies":
      return "Firmy RPVS";
    case "politics":
      return "Politické väzby";
    default:
      return "Prehľad";
  }
}
