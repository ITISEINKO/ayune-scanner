const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

process.env.TURSO_DATABASE_URL = "file::memory:";
process.env.TURSO_AUTH_TOKEN = "local-only";
process.env.CLICKUP_PPIC_PANEL_LIST_ID = "1100830000000087";
registerHooks({ resolve(specifier, context, next) {
	if (specifier === "next/server") return next("next/server.js", context);
	if (specifier === "@/lib/session") return {
		url: "data:text/javascript," + encodeURIComponent("export const clickUpUserIdForToken = async () => 'admin';"),
		shortCircuit: true,
	};
	return next(specifier.startsWith("@/") ? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href : specifier, context);
} });

const { loadCurrentStatusDuration } = require("../src/lib/projectDashboard.ts");
const nativeFetch = global.fetch;
global.fetch = async (input) => {
	assert.match(String(input), /\/task\/completed-project\/time_in_status$/);
	return Response.json({
		current_status: { status: "complete", total_time: { since: "1794987575932", by_minute: 1 } },
		status_history: [{ status: "In Progress", total_time: { since: "1791861180000", by_minute: 100 } }],
	});
};

(async () => {
	try {
		assert.deepEqual(await loadCurrentStatusDuration("test-token", "completed-project", AbortSignal.timeout(1000)), {
			minutes: null,
			since: null,
			inProgressSince: "1791861180000",
		}, "completed tasks get the In Progress entry from status history");
	} finally {
		global.fetch = nativeFetch;
	}
	console.log("ClickUp status history: completed-task start timestamp fallback passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
