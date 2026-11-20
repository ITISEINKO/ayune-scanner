CREATE TABLE IF NOT EXISTS `ppic_hpl_snapshot` (
	`model_id` text NOT NULL,
	`revision` text NOT NULL,
	`room_id` text NOT NULL,
	`panel_id` text NOT NULL,
	`serial` text NOT NULL,
	`status` text NOT NULL,
	`side_1` text,
	`side_2` text,
	`parent_id` text,
	`synced_at` text NOT NULL,
	PRIMARY KEY(`model_id`, `revision`, `room_id`, `panel_id`)
);
