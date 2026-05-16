import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("Missing DATABASE_URL for Neon Postgres");
    }
    db = drizzle(neon(databaseUrl), { schema });
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
