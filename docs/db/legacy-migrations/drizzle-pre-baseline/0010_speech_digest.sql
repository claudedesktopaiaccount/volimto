ALTER TABLE "speeches" ADD COLUMN IF NOT EXISTS "clean_title_sk" text;
--> statement-breakpoint
ALTER TABLE "speeches" ADD COLUMN IF NOT EXISTS "speech_type" text;
--> statement-breakpoint
ALTER TABLE "speeches" ADD COLUMN IF NOT EXISTS "summary_sk" text;
--> statement-breakpoint
ALTER TABLE "speeches" ADD COLUMN IF NOT EXISTS "key_points_sk" text;
--> statement-breakpoint
ALTER TABLE "speeches" ADD COLUMN IF NOT EXISTS "summary_status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "speeches" ADD COLUMN IF NOT EXISTS "summary_model" text;
--> statement-breakpoint
ALTER TABLE "speeches" ADD COLUMN IF NOT EXISTS "summarized_at" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "speeches_summary_status_idx" ON "speeches" ("summary_status");
