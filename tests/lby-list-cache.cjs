// Run: node tests/lby-list-cache.cjs
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const { createClient } = require("@libsql/client");

async function main() {
	const db = createClient({
		url: `file:${join(mkdtempSync(join(tmpdir(), "lby-list-cache-")), "list.db").replaceAll("\\", "/")}`,
	});
	const cached = new Map(),
		module = { exports: {} };
	let listReads = 0;
	const execute = db.execute.bind(db);
	db.execute = (query) => {
		if (
			typeof query === "string" &&
			query.includes("LEFT JOIN ppic_lby_source_link")
		)
			listReads++;
		return execute(query);
	};
	runInNewContext(
		ts.transpileModule(readFileSync("src/lib/panelLocationStore.ts", "utf8"), {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2017,
				esModuleInterop: true,
			},
		}).outputText,
		{
			module,
			exports: module.exports,
			Buffer,
			process: { env: { TURSO_DATABASE_URL: "local-list-cache-test" } },
			require: (id) => {
				if (id === "@/lib/db") return { db };
				if (id === "next/server") return { after: (callback) => callback() };
				if (id.endsWith("catalog.json"))
					return { bundled: { version: "bundle-v1" } };
				if (id === "@/lib/panelLocation")
					return { withPanelLocationDetails: (snapshot) => snapshot };
				if (id === "next/cache")
					return {
						unstable_cache:
							(fn, key, options) =>
							async (...args) => {
								const cacheKey = JSON.stringify([key, args]);
								if (!cached.has(cacheKey))
									cached.set(cacheKey, {
										tags: options?.tags ?? [],
										value: await fn(...args),
									});
								return cached.get(cacheKey).value;
							},
						revalidateTag: (tag, options) => {
							assert.equal(options.expire, 0, "changes expire immediately");
							for (const [key, value] of cached)
								if (value.tags.includes(tag)) cached.delete(key);
						},
					};
				return require(id);
			},
		},
	);
	try {
		const store = module.exports;
		await store.getLbyImportState("bundled");
		await db.execute(
			"INSERT INTO ppic_panel_location_project(project_id) VALUES ('bundled'), ('empty')",
		);
		await db.execute(
			"INSERT INTO ppic_lby_source_link VALUES ('bundled', 'https://example.test/share')",
		);
		for (const n of [1, 2])
			await db.execute({
				sql: "INSERT INTO ppic_panel_location_revision VALUES (?, ?, ?, ?, ?, ?, ?)",
				args: [
					"bundled",
					"revision-" + n,
					JSON.stringify({
						projectKey: "bundled",
						name: "Model",
						revision: "revision-" + n,
					}),
					Buffer.alloc(0),
					Buffer.alloc(0),
					"local",
					n,
				],
			});
		const plain = (value) => JSON.parse(JSON.stringify(value));
		const first = await store.listLbyImports();
		assert.deepEqual(
			plain(first),
			plain(
				await Promise.all([
					store.getLbyImportState("bundled"),
					store.getLbyImportState("empty"),
				]),
			),
		);
		assert.deepEqual(
			plain(first[0].versions.map((version) => version.versionNumber)),
			[2, 1],
		);
		await store.listLbyImports();
		assert.equal(
			listReads,
			1,
			"cold list uses one query; warm list uses zero queries",
		);
		await store.activateLbyImport("bundled", null, null);
		await store.listLbyImports();
		assert.equal(listReads, 2, "successful rollback expires the list");
		await assert.rejects(
			store.activateLbyImport("bundled", null, "stale"),
			/IMPORT_CONFLICT/,
		);
		await store.listLbyImports();
		assert.equal(
			listReads,
			2,
			"failed mutation does not expire valid cached data",
		);
		console.log(
			"PASS: one-query listing, empty models, complete ordered history/source metadata, warm cache and success-only invalidation.",
		);
	} finally {
		db.close();
	}
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
