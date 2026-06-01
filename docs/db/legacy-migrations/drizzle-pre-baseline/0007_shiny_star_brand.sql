ALTER TABLE `notification_log` ADD `date` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `notif_log_user_type_date_unique` ON `notification_log` (`user_id`,`type`,`date`);