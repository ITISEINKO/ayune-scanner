import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
