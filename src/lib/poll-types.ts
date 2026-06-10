export const WIKIPEDIA_POLLS_URL =
  "https://en.wikipedia.org/wiki/Opinion_polling_for_the_next_Slovak_parliamentary_election";

export interface RawPollRow {
  agency: string;
  publishedDate: string;
  sampleSize: number | null;
  results: Record<string, number>;
}
