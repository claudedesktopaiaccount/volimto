DROP INDEX `api_usage_key_idx`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`stripe_subscription_id` text,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "user_id", "key_hash", "tier", "stripe_subscription_id", "created_at", "revoked_at") SELECT "id", "user_id", "key_hash", "tier", "stripe_subscription_id", "created_at", "revoked_at" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_kalkulator_weights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`answer_index` integer NOT NULL,
	`party_id` text NOT NULL,
	`weight` real DEFAULT 0 NOT NULL,
	`source_url` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_kalkulator_weights`("id", "question_id", "answer_index", "party_id", "weight", "source_url", "updated_at") SELECT "id", "question_id", "answer_index", "party_id", "weight", "source_url", "updated_at" FROM `kalkulator_weights`;--> statement-breakpoint
DROP TABLE `kalkulator_weights`;--> statement-breakpoint
ALTER TABLE `__new_kalkulator_weights` RENAME TO `kalkulator_weights`;--> statement-breakpoint
CREATE UNIQUE INDEX `kalkulator_q_a_p_unique` ON `kalkulator_weights` (`question_id`,`answer_index`,`party_id`);--> statement-breakpoint
CREATE INDEX `kalkulator_question_idx` ON `kalkulator_weights` (`question_id`);