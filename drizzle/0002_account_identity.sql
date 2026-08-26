DROP INDEX IF EXISTS `users_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_business_email_unique` ON `users` (`business_id`,`email`);
