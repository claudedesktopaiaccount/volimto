DELETE FROM "api_usage"
WHERE "key_id" IN (
  SELECT "id" FROM "api_keys" WHERE "user_id" IS NOT NULL
);

DELETE FROM "api_keys" WHERE "user_id" IS NOT NULL;
DELETE FROM "notification_log";
DELETE FROM "user_notification_prefs";
DELETE FROM "user_sessions";
DELETE FROM "user_predictions" WHERE "user_id" IS NOT NULL;
DELETE FROM "prediction_scores" WHERE "user_id" IS NOT NULL;
DELETE FROM "users";

UPDATE "crowd_aggregates" AS ca
SET
  "total_bets" = COALESCE((
    SELECT COUNT(*)::integer
    FROM "user_predictions" up
    WHERE up."party_id" = ca."party_id"
  ), 0),
  "avg_predicted_pct" = (
    SELECT AVG(up."predicted_pct")
    FROM "user_predictions" up
    WHERE up."party_id" = ca."party_id"
  ),
  "computed_at" = NOW()::text;

ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_sub" text;
CREATE UNIQUE INDEX "users_google_sub_unique" ON "users" ("google_sub");
