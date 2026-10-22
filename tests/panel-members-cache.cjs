// Run: node tests/panel-members-cache.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");
const { QueryClient, QueryObserver } = require("@tanstack/react-query");

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const key = ["panel-members"];
let serverData = { members: [{ id: "member", name: "Member" }], roles: {}, permissions: {} };
let reads = 0;
let attach;
let cleanup;
let unobserve;
let listener;
let closed = false;
const channel = {
	subscribe(_event, callback) {
		listener = callback;
		return new Promise((resolve) => { attach = resolve; });
	},
	unsubscribe() { listener = undefined; },
};
const moduleUnderTest = { exports: {} };
runInNewContext(transpileModule(readFileSync("src/hooks/use-panel-members.ts", "utf8"), {
	compilerOptions: { module: ModuleKind.CommonJS },
}).outputText, {
	module: moduleUnderTest,
	exports: moduleUnderTest.exports,
	console,
	fetch: async () => { reads++; return { ok: true, json: async () => serverData }; },
	require(id) {
		if (id === "ably") return { Realtime: class {
			channels = { get: () => channel };
			close() { closed = true; }
		} };
		if (id === "react") return { useEffect: (effect) => { cleanup = effect(); } };
		if (id === "@tanstack/react-query") return {
			queryOptions: (options) => options,
			useQueryClient: () => client,
			useMutation: () => ({}),
			useQuery: (options) => {
				const observer = new QueryObserver(client, options);
				unobserve = observer.subscribe(() => {});
				return observer.getCurrentResult();
			},
		};
		if (id === "@/types/ppic") return {
			isPpicRole: (role) => role === "MEMBER" || role === "SUPER_ADMIN",
			ppicStatuses: (statuses) => statuses,
		};
		throw new Error(`Unexpected import: ${id}`);
	},
});
const settle = () => new Promise((resolve) => setImmediate(resolve));
const mount = () => moduleUnderTest.exports.usePanelMembers();
const unmount = () => { cleanup(); unobserve(); };

(async () => {
	client.setQueryData(key, serverData);
	mount();
	assert.equal(reads, 0, "cached data stays visible until the subscription attaches");
	serverData = { ...serverData, permissions: { member: ["BARANG_DITERIMA"] } };
	attach();
	await settle();
	assert.equal(reads, 1, "attachment refreshes the cached permission snapshot");
	assert.deepEqual(JSON.parse(JSON.stringify(client.getQueryData(key))), serverData);
	listener({ data: { userId: "member", allowedStatus: ["SEDANG_DIPACKING"] } });
	assert.equal(client.getQueryData(key).permissions.member[0], "SEDANG_DIPACKING");
	assert.equal(reads, 1, "live events still patch the cache without a fetch");
	unmount();
	assert.equal(closed, true);
	serverData = { ...serverData, permissions: { member: ["TERPASANG_DIGUNAKAN"] } };
	mount();
	attach();
	await settle();
	assert.equal(reads, 2, "returning to Settings refreshes changes missed while away");
	assert.deepEqual(JSON.parse(JSON.stringify(client.getQueryData(key))), serverData);
	unmount();
	mount();
	unmount();
	attach();
	await settle();
	assert.equal(reads, 2, "late attachment after unmount does not refresh");
	client.clear();
	console.log("PASS: Settings attachment refresh, missed changes, live events and unmount cleanup.");
})().catch((error) => { client.clear(); console.error(error); process.exitCode = 1; });
