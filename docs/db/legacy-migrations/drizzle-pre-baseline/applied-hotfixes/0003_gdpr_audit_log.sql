CREATE TABLE `gdpr_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`visitor_id_hash` text NOT NULL,
	`timestamp` text NOT NULL,
	`records_affected` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gdpr_audit_log_action_idx` ON `gdpr_audit_log` (`action`);
--> statement-breakpoint
CREATE INDEX `gdpr_audit_log_timestamp_idx` ON `gdpr_audit_log` (`timestamp`);
