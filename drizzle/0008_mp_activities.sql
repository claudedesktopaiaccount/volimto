CREATE TABLE `mp_interpellations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mp_id` integer NOT NULL,
	`date` text NOT NULL,
	`addressee` text,
	`subject` text NOT NULL,
	`url` text NOT NULL,
	`answer_url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mp_id`) REFERENCES `mps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mp_interp_mp_idx` ON `mp_interpellations` (`mp_id`);--> statement-breakpoint
CREATE INDEX `mp_interp_date_idx` ON `mp_interpellations` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `mp_interp_mp_url_unique` ON `mp_interpellations` (`mp_id`,`url`);--> statement-breakpoint
CREATE TABLE `mp_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mp_id` integer NOT NULL,
	`date` text NOT NULL,
	`subject` text NOT NULL,
	`url` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mp_id`) REFERENCES `mps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mp_questions_mp_idx` ON `mp_questions` (`mp_id`);--> statement-breakpoint
CREATE INDEX `mp_questions_date_idx` ON `mp_questions` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `mp_questions_mp_url_unique` ON `mp_questions` (`mp_id`,`url`);--> statement-breakpoint
CREATE TABLE `mp_legislation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mp_id` integer NOT NULL,
	`cislo_tlace` text,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`status` text,
	`url` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mp_id`) REFERENCES `mps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mp_legis_mp_idx` ON `mp_legislation` (`mp_id`);--> statement-breakpoint
CREATE INDEX `mp_legis_date_idx` ON `mp_legislation` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `mp_legis_mp_url_unique` ON `mp_legislation` (`mp_id`,`url`);--> statement-breakpoint
CREATE TABLE `mp_amendments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mp_id` integer NOT NULL,
	`to_law` text NOT NULL,
	`date` text NOT NULL,
	`url` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mp_id`) REFERENCES `mps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mp_amend_mp_idx` ON `mp_amendments` (`mp_id`);--> statement-breakpoint
CREATE INDEX `mp_amend_date_idx` ON `mp_amendments` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `mp_amend_mp_url_unique` ON `mp_amendments` (`mp_id`,`url`);--> statement-breakpoint
CREATE TABLE `mp_foreign_trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mp_id` integer NOT NULL,
	`date` text NOT NULL,
	`country` text NOT NULL,
	`purpose` text,
	`cost_eur` real,
	`source_url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mp_id`) REFERENCES `mps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mp_trips_mp_idx` ON `mp_foreign_trips` (`mp_id`);--> statement-breakpoint
CREATE INDEX `mp_trips_date_idx` ON `mp_foreign_trips` (`date`);--> statement-breakpoint
CREATE TABLE `mp_assistants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mp_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mp_id`) REFERENCES `mps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mp_assist_mp_idx` ON `mp_assistants` (`mp_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mp_assist_mp_name_unique` ON `mp_assistants` (`mp_id`,`name`);--> statement-breakpoint
CREATE TABLE `mp_offices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mp_id` integer NOT NULL,
	`address` text NOT NULL,
	`city` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mp_id`) REFERENCES `mps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mp_offices_mp_idx` ON `mp_offices` (`mp_id`);
