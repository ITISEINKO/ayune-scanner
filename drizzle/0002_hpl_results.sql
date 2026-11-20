CREATE TABLE `ppic_hpl_result` (
	`model_id` text NOT NULL,
	`revision` text NOT NULL,
	`room_id` text NOT NULL,
	`panel_id` text NOT NULL,
	`serial` text NOT NULL,
	`status` text NOT NULL,
	`leaf_task_id` text,
	`synced_at` text NOT NULL,
	PRIMARY KEY(`model_id`, `revision`, `room_id`, `panel_id`)
);
