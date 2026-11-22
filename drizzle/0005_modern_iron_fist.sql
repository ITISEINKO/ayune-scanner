CREATE VIEW `ppic_auth_permissions` AS SELECT a."userId" AS user_id, p.clickup_user_id, p.role, p.allowed_status, p.active, p.can_import_lby
	FROM account a JOIN ppic_permissions p ON p.clickup_user_id = a."accountId"
	WHERE a."providerId" = 'clickup';