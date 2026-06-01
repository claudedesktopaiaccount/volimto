CREATE TABLE `candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`party_id` text NOT NULL,
	`name` text NOT NULL,
	`list_rank` integer NOT NULL,
	`role` text,
	`portrait_url` text,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `candidates_party_id_idx` ON `candidates` (`party_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `candidates_party_rank_unique` ON `candidates` (`party_id`,`list_rank`);