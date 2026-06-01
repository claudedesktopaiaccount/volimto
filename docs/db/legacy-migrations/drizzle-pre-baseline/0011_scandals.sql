CREATE TABLE IF NOT EXISTS "scandals" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title_sk" text NOT NULL,
  "summary_sk" text NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text,
  "status" text DEFAULT 'vysetruje_sa' NOT NULL,
  "category" text NOT NULL,
  "institution_investigating" text,
  "verdict_url" text,
  "severity" integer DEFAULT 1 NOT NULL,
  "is_editorial_opinion" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scandals_slug_unique" ON "scandals" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandals_status_idx" ON "scandals" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandals_category_idx" ON "scandals" ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandals_severity_idx" ON "scandals" ("severity");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandals_start_date_idx" ON "scandals" ("start_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scandal_politician_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "scandal_id" integer NOT NULL,
  "mp_id" integer NOT NULL,
  "role_in_scandal" text NOT NULL,
  CONSTRAINT "scandal_politician_links_scandal_id_scandals_id_fk"
    FOREIGN KEY ("scandal_id") REFERENCES "scandals"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "scandal_politician_links_mp_id_mps_id_fk"
    FOREIGN KEY ("mp_id") REFERENCES "mps"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_pol_links_scandal_id_idx" ON "scandal_politician_links" ("scandal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_pol_links_mp_id_idx" ON "scandal_politician_links" ("mp_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scandal_pol_links_unique" ON "scandal_politician_links" ("scandal_id", "mp_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scandal_sources" (
  "id" serial PRIMARY KEY NOT NULL,
  "scandal_id" integer NOT NULL,
  "url" text NOT NULL,
  "outlet_name" text NOT NULL,
  "published_date" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "archive_url" text,
  CONSTRAINT "scandal_sources_scandal_id_scandals_id_fk"
    FOREIGN KEY ("scandal_id") REFERENCES "scandals"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_sources_scandal_id_idx" ON "scandal_sources" ("scandal_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scandal_sources_unique" ON "scandal_sources" ("scandal_id", "url");
