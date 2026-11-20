const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(":memory:");
try {
	db.exec("PRAGMA foreign_keys = ON");
	db.exec(readFileSync("drizzle/0000_gigantic_fabian_cortez.sql", "utf8"));
	db.exec("INSERT INTO ppic_hpl_group (task_id, side_1, synced_at) VALUES ('parent', 'HPL-1', '2026-01-01')");
	db.exec("INSERT INTO ppic_hpl_panel VALUES ('panel-1', 'parent', '001'), ('panel-2', 'parent', '002')");
	assert.equal(db.prepare("SELECT g.side_1 FROM ppic_hpl_panel p JOIN ppic_hpl_group g ON g.task_id = p.parent_task_id WHERE p.serial = ?").get("002").side_1, "HPL-1");
	assert.throws(() => db.exec("INSERT INTO ppic_hpl_panel VALUES ('orphan', 'missing', '003')"));
	assert.throws(() => db.exec("INSERT INTO ppic_hpl_panel VALUES ('panel-1', 'parent', '004')"));
	console.log("HPL group, serial mapping and constraints passed");
} finally { db.close(); }
