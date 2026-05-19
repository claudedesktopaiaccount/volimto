CREATE TABLE "mp_activity_scrape_state" (
  "id" serial PRIMARY KEY NOT NULL,
  "mp_id" integer NOT NULL,
  "last_attempt_at" text,
  "last_success_at" text,
  "next_eligible_at" text,
  "fail_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "updated_at" text NOT NULL,
  CONSTRAINT "mp_activity_scrape_state_mp_id_mps_id_fk"
    FOREIGN KEY ("mp_id") REFERENCES "mps"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mp_activity_state_mp_unique" ON "mp_activity_scrape_state" ("mp_id");
--> statement-breakpoint
CREATE INDEX "mp_activity_state_next_idx" ON "mp_activity_scrape_state" ("next_eligible_at");
--> statement-breakpoint
CREATE INDEX "mp_activity_state_success_idx" ON "mp_activity_scrape_state" ("last_success_at");
