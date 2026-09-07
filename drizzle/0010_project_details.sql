ALTER TABLE `projects` ADD `description` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD `contact_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD `contact_phone` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD `start_date` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `target_date` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `completed_date` text;
