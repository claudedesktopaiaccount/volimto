CREATE TABLE `coalition_scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`party_ids` text NOT NULL,
	`combined_probability` real,
	`predicted_seats` integer,
	`prediction_id` integer,
	FOREIGN KEY (`prediction_id`) REFERENCES `predictions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crowd_aggregates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`party_id` text NOT NULL,
	`total_bets` integer DEFAULT 0 NOT NULL,
	`avg_predicted_pct` real,
	`computed_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`published_at` text,
	`scraped_at` text NOT NULL,
	`category` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_items_url_unique` ON `news_items` (`url`);--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`abbreviation` text NOT NULL,
	`color` text NOT NULL,
	`secondary_color` text,
	`leader` text NOT NULL,
	`ideology` text,
	`seats` integer DEFAULT 0,
	`logo_url` text,
	`portrait_url` text
);
--> statement-breakpoint
CREATE TABLE `party_promises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`party_id` text NOT NULL,
	`promise_text` text NOT NULL,
	`category` text NOT NULL,
	`is_pro` integer NOT NULL,
	`source_url` text,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `party_promises_party_id_idx` ON `party_promises` (`party_id`);--> statement-breakpoint
CREATE TABLE `poll_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`poll_id` integer NOT NULL,
	`party_id` text NOT NULL,
	`percentage` real NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `poll_results_poll_id_idx` ON `poll_results` (`poll_id`);--> statement-breakpoint
CREATE INDEX `poll_results_party_id_idx` ON `poll_results` (`party_id`);--> statement-breakpoint
CREATE TABLE `polls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agency` text NOT NULL,
	`published_date` text NOT NULL,
	`fieldwork_start` text,
	`fieldwork_end` text,
	`sample_size` integer,
	`source_url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `polls_agency_date_unique` ON `polls` (`agency`,`published_date`);--> statement-breakpoint
CREATE TABLE `prediction_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prediction_id` integer NOT NULL,
	`party_id` text NOT NULL,
	`predicted_pct` real NOT NULL,
	`lower_bound` real NOT NULL,
	`upper_bound` real NOT NULL,
	`win_probability` real NOT NULL,
	`parliament_probability` real NOT NULL,
	FOREIGN KEY (`prediction_id`) REFERENCES `predictions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pred_results_prediction_id_idx` ON `prediction_results` (`prediction_id`);--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`generated_at` text NOT NULL,
	`model_version` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`party_id` text NOT NULL,
	`predicted_pct` real,
	`coalition_pick` text,
	`created_at` text NOT NULL,
	`region` text,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_predictions_visitor_idx` ON `user_predictions` (`visitor_id`);