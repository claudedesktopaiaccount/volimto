import { seedE2eDatabase } from "../scripts/seed-e2e";

export default async function globalSetup() {
  const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
  if (!e2eDatabaseUrl) {
    throw new Error("E2E_DATABASE_URL is required for Playwright tests.");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === e2eDatabaseUrl) {
    throw new Error("E2E_DATABASE_URL must not equal DATABASE_URL.");
  }

  process.env.DATABASE_URL = e2eDatabaseUrl;
  await seedE2eDatabase(e2eDatabaseUrl);
}
