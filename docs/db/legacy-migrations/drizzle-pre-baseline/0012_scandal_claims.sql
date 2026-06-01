CREATE TABLE IF NOT EXISTS "scandal_claims" (
  "id" serial PRIMARY KEY NOT NULL,
  "scandal_id" integer NOT NULL,
  "mp_id" integer,
  "target_label" text NOT NULL,
  "claim_kind" text NOT NULL,
  "process_status" text NOT NULL,
  "responsibility_kind" text NOT NULL,
  "statement_sk" text NOT NULL,
  "counterpoint_sk" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "scandal_claims_scandal_id_scandals_id_fk"
    FOREIGN KEY ("scandal_id") REFERENCES "scandals"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "scandal_claims_mp_id_mps_id_fk"
    FOREIGN KEY ("mp_id") REFERENCES "mps"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_claims_scandal_id_idx" ON "scandal_claims" ("scandal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_claims_mp_id_idx" ON "scandal_claims" ("mp_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_claims_process_status_idx" ON "scandal_claims" ("process_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scandal_claim_sources" (
  "id" serial PRIMARY KEY NOT NULL,
  "claim_id" integer NOT NULL,
  "source_id" integer NOT NULL,
  CONSTRAINT "scandal_claim_sources_claim_id_scandal_claims_id_fk"
    FOREIGN KEY ("claim_id") REFERENCES "scandal_claims"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "scandal_claim_sources_source_id_scandal_sources_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "scandal_sources"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_claim_sources_claim_id_idx" ON "scandal_claim_sources" ("claim_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_claim_sources_source_id_idx" ON "scandal_claim_sources" ("source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scandal_claim_sources_unique" ON "scandal_claim_sources" ("claim_id", "source_id");
