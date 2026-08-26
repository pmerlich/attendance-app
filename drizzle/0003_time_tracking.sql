CREATE INDEX `idx_time_entries_project_id` ON `time_entries` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_time_entries_user_active` ON `time_entries` (`user_id`,`ended_at`);