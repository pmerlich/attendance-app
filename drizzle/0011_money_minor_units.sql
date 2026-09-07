ALTER TABLE `users` ADD `hourly_cost_cents` integer;
--> statement-breakpoint
UPDATE `users` SET `hourly_cost_cents` = ROUND(`hourly_cost` * 100) WHERE `hourly_cost` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD `fixed_price_cents` integer;
--> statement-breakpoint
ALTER TABLE `projects` ADD `client_hourly_rate_cents` integer;
--> statement-breakpoint
UPDATE `projects` SET `fixed_price_cents` = ROUND(`fixed_price` * 100), `client_hourly_rate_cents` = ROUND(`client_hourly_rate` * 100);
--> statement-breakpoint
ALTER TABLE `payments` ADD `amount_cents` integer;
--> statement-breakpoint
UPDATE `payments` SET `amount_cents` = ROUND(`amount` * 100);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `amount_cents` integer;
--> statement-breakpoint
UPDATE `expenses` SET `amount_cents` = ROUND(`amount` * 100);
