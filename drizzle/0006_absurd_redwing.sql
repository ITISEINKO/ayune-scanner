ALTER TABLE `user` ADD `role` text DEFAULT 'MEMBER' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `allowed_status` text;--> statement-breakpoint
ALTER TABLE `user` ADD `active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `can_import_lby` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `permission_updated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `permission_updated_at` text;--> statement-breakpoint
UPDATE `user` SET
	(role, allowed_status, active, can_import_lby, permission_updated_by, permission_updated_at) = (
		SELECT p.role, p.allowed_status, p.active, p.can_import_lby, p.updated_by, p.updated_at
		FROM account a JOIN ppic_permissions p ON p.clickup_user_id = a."accountId"
		WHERE a."userId" = "user".id AND a."providerId" = 'clickup'
	)
WHERE EXISTS (
	SELECT 1 FROM account a JOIN ppic_permissions p ON p.clickup_user_id = a."accountId"
	WHERE a."userId" = "user".id AND a."providerId" = 'clickup'
);--> statement-breakpoint
DROP VIEW `ppic_auth_permissions`;
