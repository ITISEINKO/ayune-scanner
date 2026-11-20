CREATE TABLE `ppic_hpl_group` (
	`task_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`side_1` text,
	`side_2` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ppic_hpl_panel` (
	`task_id` text PRIMARY KEY NOT NULL,
	`parent_task_id` text NOT NULL,
	`serial` text NOT NULL,
	FOREIGN KEY (`parent_task_id`) REFERENCES `ppic_hpl_group`(`task_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ppic_hpl_panel_serial` ON `ppic_hpl_panel` (`serial`);