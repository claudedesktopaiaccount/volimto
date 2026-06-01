CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`key_hash` text NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`stripe_subscription_id` text,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `api_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_usage_key_date_unique` ON `api_usage` (`key_id`,`date`);--> statement-breakpoint
CREATE INDEX `api_usage_key_idx` ON `api_usage` (`key_id`);--> statement-breakpoint
CREATE TABLE `kalkulator_weights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`answer_index` integer NOT NULL,
	`party_id` text NOT NULL,
	`weight` real DEFAULT 0 NOT NULL,
	`source_url` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kalkulator_q_a_p_unique` ON `kalkulator_weights` (`question_id`,`answer_index`,`party_id`);--> statement-breakpoint
CREATE INDEX `kalkulator_question_idx` ON `kalkulator_weights` (`question_id`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notif_log_user_idx` ON `notification_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `notif_log_sent_idx` ON `notification_log` (`sent_at`);--> statement-breakpoint
CREATE TABLE `user_notification_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`on_new_poll` integer DEFAULT 0 NOT NULL,
	`on_score_change` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
