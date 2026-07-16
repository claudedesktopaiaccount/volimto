export const OPENDATA_PAGE_SIZE = 25;

export const OPENDATA_VIEWS = [
  "overview",
  "contracts",
  "companies",
  "politics",
] as const;

export const OPENDATA_AMOUNT_FILTERS = [
  "all",
  "known",
  "zero",
  "10k",
  "100k",
  "1m",
] as const;

export const OPENDATA_RPVS_FILTERS = ["all", "in-rpvs", "not-in-rpvs"] as const;
export const OPENDATA_LINK_FILTERS = ["all", "linked", "unlinked"] as const;
export const OPENDATA_SORTS = ["newest", "oldest", "highest", "lowest"] as const;
export const OPENDATA_COMPANY_SORTS = ["contracts", "name"] as const;

export type OpendataView = (typeof OPENDATA_VIEWS)[number];
export type OpendataAmountFilter = (typeof OPENDATA_AMOUNT_FILTERS)[number];
export type OpendataRpvsFilter = (typeof OPENDATA_RPVS_FILTERS)[number];
export type OpendataLinkFilter = (typeof OPENDATA_LINK_FILTERS)[number];
export type OpendataSort = (typeof OPENDATA_SORTS)[number];
export type OpendataCompanySort = (typeof OPENDATA_COMPANY_SORTS)[number];

export interface OpendataFilters {
  view: OpendataView;
  query: string;
  year: string;
  amount: OpendataAmountFilter;
  rpvs: OpendataRpvsFilter;
  link: OpendataLinkFilter;
  partyId: string;
  sort: OpendataSort;
  legalForm: string;
  companySort: OpendataCompanySort;
  page: number;
}

export type OpendataSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function parseOpendataFilters(
  params: OpendataSearchParams
): OpendataFilters {
  const view = enumValue(params.view, OPENDATA_VIEWS, "overview");
  const query = first(params.q).trim().slice(0, 120);
  const rawYear = first(params.year);
  const year = /^\d{4}$/.test(rawYear) ? rawYear : "";
  const rawPage = Number.parseInt(first(params.page), 10);

  return {
    view,
    query,
    year,
    amount: enumValue(params.amount, OPENDATA_AMOUNT_FILTERS, "all"),
    rpvs: enumValue(params.rpvs, OPENDATA_RPVS_FILTERS, "all"),
    link: enumValue(params.link, OPENDATA_LINK_FILTERS, "all"),
    partyId: first(params.party).trim().slice(0, 80),
    sort: enumValue(params.sort, OPENDATA_SORTS, "newest"),
    legalForm: first(params.form).trim().slice(0, 80),
    companySort: enumValue(params.companySort, OPENDATA_COMPANY_SORTS, "contracts"),
    page: Number.isFinite(rawPage) && rawPage > 0
      ? Math.min(rawPage, 100_000)
      : 1,
  };
}

export function filtersToSearchParams(
  filters: OpendataFilters,
  overrides: Partial<OpendataFilters> = {}
): URLSearchParams {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.view !== "overview") params.set("view", next.view);
  if (next.query) params.set("q", next.query);
  if (next.year) params.set("year", next.year);
  if (next.amount !== "all") params.set("amount", next.amount);
  if (next.rpvs !== "all") params.set("rpvs", next.rpvs);
  if (next.link !== "all") params.set("link", next.link);
  if (next.partyId) params.set("party", next.partyId);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.legalForm) params.set("form", next.legalForm);
  if (next.companySort !== "contracts") {
    params.set("companySort", next.companySort);
  }
  if (next.page > 1) params.set("page", String(next.page));

  return params;
}

export function opendataHref(
  filters: OpendataFilters,
  overrides: Partial<OpendataFilters> = {}
): string {
  const params = filtersToSearchParams(filters, overrides);
  const query = params.toString();
  return `/opendata${query ? `?${query}` : ""}`;
}

export function hasActiveContractFilters(filters: OpendataFilters): boolean {
  return Boolean(
    filters.query ||
      filters.year ||
      filters.amount !== "all" ||
      filters.rpvs !== "all" ||
      filters.link !== "all" ||
      filters.partyId
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function enumValue<const T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
  fallback: T[number]
): T[number] {
  const candidate = first(value);
  return allowed.includes(candidate as T[number])
    ? (candidate as T[number])
    : fallback;
}
