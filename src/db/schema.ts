import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
	image: text("image"),
	role: text("role").notNull().default("MEMBER"),
	allowedStatus: text("allowed_status"),
	active: integer("active", { mode: "boolean" }).notNull().default(false),
	canImportLby: integer("can_import_lby", { mode: "boolean" }).notNull().default(false),
	permissionUpdatedBy: text("permission_updated_by"),
	permissionUpdatedAt: text("permission_updated_at"),
	createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_userId_idx").on(table.userId)]);

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
	refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("account_userId_idx").on(table.userId)]);

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const hplGroups = sqliteTable("ppic_hpl_group", {
	taskId: text("task_id").primaryKey(),
	name: text("name"),
	side1: text("side_1"),
	side2: text("side_2"),
	syncedAt: text("synced_at").notNull(),
});

export const hplPanels = sqliteTable("ppic_hpl_panel", {
	taskId: text("task_id").primaryKey(),
	parentTaskId: text("parent_task_id").notNull().references(() => hplGroups.taskId),
	serial: text("serial").notNull(),
}, (table) => [index("ppic_hpl_panel_serial").on(table.serial)]);

export const hplResults = sqliteTable("ppic_hpl_result", {
	modelId: text("model_id").notNull(),
	revision: text("revision").notNull(),
	roomId: text("room_id").notNull(),
	panelId: text("panel_id").notNull(),
	serial: text("serial").notNull(),
	status: text("status").notNull(),
	leafTaskId: text("leaf_task_id"),
	syncedAt: text("synced_at").notNull(),
}, (table) => [primaryKey({ columns: [table.modelId, table.revision, table.roomId, table.panelId] })]);

export const hplSnapshots = sqliteTable("ppic_hpl_snapshot", {
	modelId: text("model_id").notNull(),
	revision: text("revision").notNull(),
	roomId: text("room_id").notNull(),
	panelId: text("panel_id").notNull(),
	serial: text("serial").notNull(),
	status: text("status").notNull(),
	side1: text("side_1"),
	side2: text("side_2"),
	parentId: text("parent_id"),
	syncedAt: text("synced_at").notNull(),
}, (table) => [primaryKey({ columns: [table.modelId, table.revision, table.roomId, table.panelId] })]);
