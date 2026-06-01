CREATE TABLE IF NOT EXISTS "scandal_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "scandal_id" integer NOT NULL,
  "event_date" text NOT NULL,
  "title_sk" text NOT NULL,
  "description_sk" text NOT NULL,
  "event_type" text NOT NULL,
  "source_url" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "scandal_events_scandal_id_scandals_id_fk"
    FOREIGN KEY ("scandal_id") REFERENCES "scandals"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_events_scandal_id_idx" ON "scandal_events" ("scandal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scandal_events_date_idx" ON "scandal_events" ("event_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scandal_events_unique" ON "scandal_events" ("scandal_id", "event_date", "title_sk", "source_url");
