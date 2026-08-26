CREATE TABLE `employee_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_by_auth_user_id` text,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_invitations_token_unique` ON `employee_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_employee_invitations_business_status` ON `employee_invitations` (`business_id`,`status`);--> statement-breakpoint
ALTER TABLE `users` ADD `auth_user_id` text;--> statement-breakpoint
CREATE INDEX `idx_users_auth_user_id` ON `users` (`auth_user_id`);