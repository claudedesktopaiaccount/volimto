export const SCRAPER_JOB_OPTIONS = [
  {
    id: "polls",
    label: "Prieskumy",
    description: "Wikipedia prieskumy do DB pre /prieskumy a /predikcia.",
  },
  {
    id: "news",
    label: "Správy",
    description: "Agregácia politických správ z nakonfigurovaných zdrojov.",
  },
  {
    id: "programs",
    label: "Programy strán",
    description: "Scrape programov a extrakcia sľubov strán.",
  },
  {
    id: "nrsr",
    label: "NRSR poslanci",
    description: "Poslanci, hlasovania a prejavy z NRSR.",
  },
  {
    id: "mp-activities",
    label: "Aktivity poslancov",
    description: "Detailné aktivity poslancov s rešpektovaním backoff stavu.",
  },
  {
    id: "opendata",
    label: "OpenData",
    description: "RPVS firmy, verejné zmluvy a známe dary.",
  },
  {
    id: "scandals",
    label: "Kauzy",
    description: "Scrape a uloženie káuz vrátane AI draftov.",
  },
] as const;

export type ScraperJobId = (typeof SCRAPER_JOB_OPTIONS)[number]["id"];

export const SCRAPER_JOB_IDS = SCRAPER_JOB_OPTIONS.map((job) => job.id);
