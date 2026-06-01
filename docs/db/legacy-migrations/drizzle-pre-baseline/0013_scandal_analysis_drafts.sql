ALTER TABLE "scandal_claims" ADD COLUMN IF NOT EXISTS "why_relevant_sk" text;
--> statement-breakpoint
ALTER TABLE "scandal_claims" ADD COLUMN IF NOT EXISTS "evidence_excerpt_sk" text;
--> statement-breakpoint
ALTER TABLE "scandal_claims" ADD COLUMN IF NOT EXISTS "source_type" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scandal_analysis_drafts" (
  "id" serial PRIMARY KEY NOT NULL,
  "scandal_id" integer NOT NULL,
  "case_summary_sk" text NOT NULL,
  "public_interest_sk" text NOT NULL,
  "legal_status_sk" text NOT NULL,
  "open_questions_sk" text NOT NULL,
  "actor_claims_json" text NOT NULL,
  "source_urls_json" text NOT NULL,
  "review_status" text DEFAULT 'needs_review' NOT NULL,
  "model" text NOT NULL,
  "created_at" text NOT NULL,
  "reviewed_at" text,
  CONSTRAINT "scandal_analysis_drafts_scandal_id_scandals_id_fk"
    FOREIGN KEY ("scandal_id") REFERENCES "scandals"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_analysis_drafts_scandal_id_idx" ON "scandal_analysis_drafts" ("scandal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_analysis_drafts_status_idx" ON "scandal_analysis_drafts" ("review_status");
