CREATE TABLE `gdpr_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`visitor_id_hash` text NOT NULL,
	`timestamp` text NOT NULL,
	`records_affected` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gdpr_audit_log_action_idx` ON `gdpr_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `gdpr_audit_log_timestamp_idx` ON `gdpr_audit_log` (`timestamp`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL,
	`confirmed_at` text,
	`unsubscribed_at` text,
	`source` text DEFAULT 'web'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_email_unique` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_ip_hash_idx` ON `rate_limits` (`ip_hash`);--> statement-breakpoint
CREATE INDEX `rate_limits_created_at_idx` ON `rate_limits` (`created_at`);--> statement-breakpoint
DROP INDEX IF EXISTS `user_predictions_visitor_idx`;--> statement-breakpoint
ALTER TABLE `user_predictions` ADD `fingerprint` text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_predictions_visitor_unique` ON `user_predictions` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `user_predictions_fingerprint_idx` ON `user_predictions` (`fingerprint`);--> statement-breakpoint
ALTER TABLE `user_predictions` DROP COLUMN `region`;--> statement-breakpoint
CREATE UNIQUE INDEX `crowd_aggregates_party_id_unique` ON `crowd_aggregates` (`party_id`);
