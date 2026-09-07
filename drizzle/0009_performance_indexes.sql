CREATE INDEX IF NOT EXISTS `idx_projects_business_deleted` ON `projects` (`business_id`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clients_business_deleted` ON `clients` (`business_id`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_business_created` ON `audit_log` (`business_id`,`created_at` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_time_project_deleted_ended` ON `time_entries` (`project_id`,`deleted_at`,`ended_at`);
