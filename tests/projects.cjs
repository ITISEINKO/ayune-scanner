// Run the existing Postman admin-dashboard simulation on port 4900, then:
// node --experimental-strip-types tests/projects.cjs
const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "next/server") return nextResolve("next/server.js", context);
		if (specifier === "@/lib/session") return { url: "data:text/javascript," + encodeURIComponent(`
			export const clickUpToken = async () => 'test-token';
			export const requireFreshSuperAdmin = async () => { if (!globalThis.testAdmin) throw new Error('UNAUTHORIZED'); };
		`), shortCircuit: true };
		return nextResolve(specifier.startsWith("@/")
			? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href
			: specifier, context);
	},
});
process.env.CLICKUP_PPIC_PANEL_LIST_ID = "1100830000000087";
const nativeFetch = global.fetch;
const base = "http://127.0.0.1:4900/clickup";
let mode = "project-start";
global.fetch = (input, init) => {
	const url = new URL(String(input));
	assert.equal(url.origin, "https://api.clickup.com");
	return nativeFetch(`${base}${url.pathname}${url.search}`, { ...init, headers: { "Content-Type": "application/json", "x-test-mode": mode } });
};
const request = (body) => new Request("http://localhost/api/projects", { method: "POST", body: JSON.stringify(body) });

(async () => {
	await nativeFetch(`${base}/test/reset`, { headers: { "x-test-mode": mode } });
	const { projectsByStatus, inProgressProjects } = require("../src/lib/projects.ts");
	const { GET, POST } = require("../src/app/api/projects/route.ts");
	global.testAdmin = false;
	await assert.rejects(POST(request({ task_id: "todo-project" })), /UNAUTHORIZED/);
	await assert.rejects(GET(new Request("http://localhost/api/projects?status=to%20do")), /UNAUTHORIZED/);
	await assert.rejects(GET(new Request("http://localhost/api/projects?status=complete")), /UNAUTHORIZED/);
	assert.equal((await GET(new Request("http://localhost/api/projects"))).status, 200);
	global.testAdmin = true;
	assert.equal((await POST(request(null))).status, 400);
	assert.equal((await POST(request({ task_id: " " }))).status, 400);
	assert.equal((await GET(new Request("http://localhost/api/projects?status=done"))).status, 400);
	const completed = await GET(new Request("http://localhost/api/projects?status=complete"));
	assert.equal(completed.status, 200);
	assert.deepEqual((await completed.json()).tasks.map(({ id }) => id), ["done-project", "done-project-2"], "closed parents from every page, without subtasks");
	assert.deepEqual(await inProgressProjects("test-token"), []);
	assert.deepEqual((await projectsByStatus("test-token", "to do")).map(({ id }) => id), ["todo-project"]);
	for (const task_id of ["child", "foreign", "done"]) {
		assert.equal((await POST(request({ task_id }))).status, task_id === "done" ? 409 : 404);
	}
	mode = "project-start-rate-limit";
	assert.equal((await GET(new Request("http://localhost/api/projects?status=complete"))).status, 200, "completed cache is separate from ongoing and Todo");
	assert.equal((await GET(new Request("http://localhost/api/projects?status=complete&refresh=1"))).status, 429, "manual Sync bypasses the completed cache");
	assert.equal((await POST(request({ task_id: "todo-project" }))).status, 429);
	assert.equal((await inProgressProjects("test-token")).length, 0);
	mode = "project-start";
	assert.equal((await POST(request({ task_id: "todo-project" }))).status, 200);
	assert.equal((await projectsByStatus("test-token", "to do")).length, 0);
	assert.equal((await inProgressProjects("test-token"))[0].id, "todo-project");
	assert.equal((await POST(request({ task_id: "todo-project" }))).status, 200);
	const stats = await nativeFetch(`${base}/test/writes`, { headers: { "x-test-mode": mode } }).then((response) => response.json());
	assert.equal(stats.writes, 1, "Only the first valid confirmation writes to ClickUp");
	console.log("Project listing, admin authorization, parent scope, start, retry and cache checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
