import assert from "node:assert/strict";
import { applyProjectStatusChanges } from "./projectStatus.ts";
import type { ProjectDashboard } from "../types/project.ts";

const dashboard: ProjectDashboard = {
	project: {
		task_id: "project",
		name: "Project",
		custom_id: null,
		startDate: null,
		dueDate: null,
	},
	items: [
		{
			id: "item",
			name: "Item",
			components: [
				{ id: "keep", serialNumber: null, name: "Keep", status: null, history: [] },
				{ id: "delete", serialNumber: null, name: "Delete", status: null, history: [] },
			],
		},
	],
	recentHistory: [],
	memberContribution: [],
	memberNames: {},
	statusUpdatedAt: 1,
	currentStatusDurationMinutes: null,
	currentStatusStartedAt: null,
};

const updated = applyProjectStatusChanges(dashboard, [
	{ componentTaskId: "keep", status: "BARANG_DITERIMA", updatedAt: 2 },
	{ componentTaskId: "delete", status: "DIHAPUSKAN", updatedAt: 3 },
]);

assert.equal(updated.items[0].components.length, 1);
assert.equal(updated.items[0].components[0].status, "BARANG_DITERIMA");
assert.equal(updated.statusUpdatedAt, 3);
