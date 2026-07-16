export interface VerifiedPoliticianCompanyLink {
  mpSlug: string;
  ico: string;
  companyName: string;
  politicianGivenName: string;
  politicianFamilyName: string;
  relationship: string;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string;
  identitySourceUrl: string;
  identityBirthDate: string;
  verificationMethod: "rpvs_kuv_exact_name_birth_date";
  verifiedAt: string;
}

/**
 * Identifier used by the removed name-only RPVS experiment. Keep this only so
 * old rows can be quarantined and deleted safely during import.
 */
export const LEGACY_UNVERIFIED_RPVS_NAME_MATCH_RELATIONSHIP =
  "verejný funkcionár v riadiacej štruktúre (RPVS)";

/**
 * Curated, source-backed MP-company relationships.
 *
 * Keep this list conservative: every entry needs a source proving both the
 * politician and the company ICO. Do not add name-only matches.
 */
export const VERIFIED_POLITICIAN_COMPANY_LINKS: VerifiedPoliticianCompanyLink[] = [
  {
    mpSlug: "jan-ferencak",
    ico: "37886436",
    companyName: "Nemocnica Dr. Vojtecha Alexandra v Kežmarku n.o.",
    politicianGivenName: "Ján",
    politicianFamilyName: "Ferenčák",
    relationship: "konečný užívateľ výhod (RPVS)",
    startDate: "2017-08-03",
    endDate: null,
    sourceUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/18145",
    identitySourceUrl: "https://www.nrsr.sk/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=1008&CisObdobia=9",
    identityBirthDate: "1974-06-30",
    verificationMethod: "rpvs_kuv_exact_name_birth_date",
    verifiedAt: "2026-07-16",
  },
  {
    mpSlug: "roman-malatinec",
    ico: "51744422",
    companyName: "ROZVOJOVÁ AGENTÚRA Banskobystrického samosprávneho kraja, n. o.",
    politicianGivenName: "Roman",
    politicianFamilyName: "Malatinec",
    relationship: "konečný užívateľ výhod (RPVS)",
    startDate: "2018-07-17",
    endDate: "2022-03-02",
    sourceUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/26437",
    identitySourceUrl: "https://www.nrsr.sk/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=1173&CisObdobia=9",
    identityBirthDate: "1981-07-22",
    verificationMethod: "rpvs_kuv_exact_name_birth_date",
    verifiedAt: "2026-07-16",
  },
  {
    mpSlug: "peter-sokol",
    ico: "37886851",
    companyName: "Ľubovnianska nemocnica, n.o.",
    politicianGivenName: "Peter",
    politicianFamilyName: "Sokol",
    relationship: "konečný užívateľ výhod (RPVS)",
    startDate: "2020-01-18",
    endDate: "2024-01-24",
    sourceUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/12362",
    identitySourceUrl: "https://www.nrsr.sk/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=1206&CisObdobia=9",
    identityBirthDate: "1959-04-27",
    verificationMethod: "rpvs_kuv_exact_name_birth_date",
    verifiedAt: "2026-07-16",
  },
  {
    mpSlug: "viliam-zahorcak",
    ico: "36570460",
    companyName: "Východoslovenská vodárenská spoločnosť, a.s.",
    politicianGivenName: "Viliam",
    politicianFamilyName: "Zahorčák",
    relationship: "konečný užívateľ výhod (RPVS)",
    startDate: "2020-07-09",
    endDate: "2024-01-09",
    sourceUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/13582",
    identitySourceUrl: "https://www.nrsr.sk/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=1019&CisObdobia=9",
    identityBirthDate: "1959-07-21",
    verificationMethod: "rpvs_kuv_exact_name_birth_date",
    verifiedAt: "2026-07-16",
  },
];
