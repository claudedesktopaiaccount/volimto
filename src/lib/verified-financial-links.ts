export interface VerifiedPoliticianCompanyLink {
  mpSlug: string;
  ico: string;
  companyName: string;
  relationship: string;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string;
}

/**
 * Curated, source-backed MP-company relationships.
 *
 * Keep this list conservative: every entry needs a source proving both the
 * politician and the company ICO. Do not add name-only matches.
 */
export const VERIFIED_POLITICIAN_COMPANY_LINKS: VerifiedPoliticianCompanyLink[] = [];
