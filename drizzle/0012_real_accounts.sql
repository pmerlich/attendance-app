ALTER TABLE `users` ADD `first_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `last_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `profile_image_key` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` text;
--> statement-breakpoint
CREATE TABLE `auth_sessions` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `token_hash` text NOT NULL UNIQUE, `expires_at` text NOT NULL, `last_used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `revoked_at` text);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user_active` ON `auth_sessions` (`user_id`,`revoked_at`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `token_hash` text NOT NULL UNIQUE, `purpose` text NOT NULL, `expires_at` text NOT NULL, `used_at` text, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_auth_tokens_user_purpose` ON `auth_tokens` (`user_id`,`purpose`,`used_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_email_unique` ON `users` (lower(`email`)) WHERE `password_hash` IS NOT NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE TABLE `auth_login_attempts` (`id` text PRIMARY KEY NOT NULL, `attempt_key` text NOT NULL, `succeeded` integer DEFAULT 0 NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_auth_login_attempts_key_created` ON `auth_login_attempts` (`attempt_key`,`created_at`);
