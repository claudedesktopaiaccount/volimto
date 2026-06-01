-- Drop the old non-unique index
DROP INDEX IF EXISTS "user_predictions_visitor_idx";

-- Add UNIQUE index on visitor_id to prevent duplicate votes atomically
CREATE UNIQUE INDEX IF NOT EXISTS "user_predictions_visitor_unique" ON "user_predictions" ("visitor_id");
