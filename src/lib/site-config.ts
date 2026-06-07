export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://volimto.sk";
export const SITE_NAME = "VolímTo";
export const SITE_DESCRIPTION =
  "Agregátor prieskumov, predikcie volieb, koaličný simulátor a tipovanie pre slovenské parlamentné voľby.";
export const SITE_LOCALE = "sk_SK";

/** Estimated date of the next Slovak parliamentary election (4-year cycle from September 2023). */
export const ELECTION_DATE_ESTIMATE = new Date("2027-09-30");

/** Brand colors used in generated icons and OG images. */
const BRAND_COLORS = {
  ink: "#111110",
  paper: "#F4F3EE",
  divider: "#D6D5CF",
} as const;

