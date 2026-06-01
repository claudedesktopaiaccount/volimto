CREATE TABLE `prediction_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`visitor_id` text,
	`election_id` text NOT NULL,
	`winner_score` real,
	`percentage_score` real,
	`coalition_score` real,
	`total_score` real DEFAULT 0 NOT NULL,
	`scored_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pred_scores_user_idx` ON `prediction_scores` (`user_id`);--> statement-breakpoint
CREATE INDEX `pred_scores_election_idx` ON `prediction_scores` (`election_id`);--> statement-breakpoint
CREATE INDEX `pred_scores_total_idx` ON `prediction_scores` (`total_score`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_idx` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`email_verified_at` text,
	`visitor_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_visitor_id_idx` ON `users` (`visitor_id`);--> statement-breakpoint
ALTER TABLE `user_predictions` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `user_predictions_user_id_idx` ON `user_predictions` (`user_id`);