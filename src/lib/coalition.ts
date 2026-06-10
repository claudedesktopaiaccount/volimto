/**
 * Coalition membership for the Fico IV government (formed Oct 2023).
 * Single source of truth for any coalition-aware UI/feature.
 * Lift to DB if/when government changes warrant it.
 */
export const COALITION_PARTY_IDS = new Set<string>(["smer-sd", "hlas-sd", "sns", "vidieka"]);

export const TOTAL_SEATS = 150;
