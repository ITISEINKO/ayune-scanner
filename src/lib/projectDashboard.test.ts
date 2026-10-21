import assert from "node:assert/strict";
import { descendantsOf } from "./descendantsOf.ts";

const descendants = descendantsOf([
	{
		id: "item",
		parent: "project",
		subtasks: [{ id: "component", parent: "item" }],
	},
]);

assert.deepEqual(
	descendants.map((task) => task.id),
	["item", "component"],
);
