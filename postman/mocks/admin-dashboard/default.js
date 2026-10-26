// Synthetic fixtures follow the ClickUp task/custom-field contract used by the dashboard.
const http = require("node:http");
const listId = "1100830000000087";
let projectStarted = false;
let projectWrites = 0;
let projectCompleted = false;
let completeWrites = 0;
const component = (id, status) => ({
	id, parent: "group", name: id,
	custom_fields: [
		{ id: "3d3a2535-9d01-4ca2-8a51-9b2f9182857c", value: status },
		{ id: "dd6c185c-bd28-4967-b238-f386e98a64c8", value: id },
	],
});

http.createServer((req, res) => {
	const url = new URL(req.url, "http://localhost");
	const mode = req.headers["x-test-mode"];
	let status = 200;
	let body;
	if (mode?.startsWith("project-complete")) {
		const task = { id: "complete-project", name: "Rak Buku · Kantor Contoh", parent: null, list: { id: listId }, date_closed: projectCompleted ? String(Date.parse("2026-10-22T10:00:00Z")) : null, status: { status: projectCompleted ? "complete" : "in progress" } };
		if (url.pathname === "/test/reset") {
			projectCompleted = false; completeWrites = 0; body = {};
		} else if (url.pathname === "/test/writes") {
			body = { writes: completeWrites };
		} else if (url.pathname === `/api/v2/list/${listId}/task`) {
			if (url.searchParams.get("statuses[]") === "complete") {
				body = { tasks: projectCompleted && url.searchParams.get("include_closed") === "true" ? [task] : [], last_page: true };
			} else {
			body = { tasks: projectCompleted ? [] : [task], last_page: true };
			}
		} else if (url.pathname === "/api/v2/team/90182186539/task") {
			if (url.searchParams.get("parent") !== task.id || url.searchParams.get("subtasks") !== "true" || url.searchParams.get("include_closed") !== "true") {
				status = 400; body = { error: "Invalid hierarchy query" };
			} else if (url.searchParams.get("page") === "0") {
				body = { tasks: [{ id: "group", parent: task.id }, component("one", "22619cd5-078e-4b12-a6d2-96d723eed52b")], last_page: false };
			} else if (mode === "project-complete-rate-limit") {
				status = 429; body = {};
			} else if (mode === "project-complete-malformed") {
				body = { last_page: true };
			} else {
				const value = mode === "project-complete-unscanned" ? null : mode === "project-complete-unknown" ? "unknown" : "dc6eef4c-6843-4043-9938-b14388511be0";
				body = { tasks: [component("two", value), { id: "document", parent: "group" }], last_page: true };
			}
		} else if (req.method === "GET" && url.pathname.startsWith("/api/v2/task/")) {
			const id = url.pathname.split("/").pop();
			if (mode === "project-complete-forbidden") { status = 403; body = {}; }
			else
			body = { ...task, id,
				...(id === "child" ? { parent: task.id } : {}),
				...(id === "foreign" ? { list: { id: "other-list" } } : {}),
				...(id === "todo" ? { status: { status: "to do" } } : {}),
			};
		} else if (req.method === "PUT" && url.pathname === `/api/v2/task/${task.id}`) {
			if (mode === "project-complete-update-fail") { status = 503; body = {}; }
			else if (req.body?.status !== "complete" || Object.keys(req.body).length !== 1) { status = 400; body = {}; }
			else { projectCompleted = true; completeWrites++; body = { ...task, status: { status: "complete" } }; }
		} else { status = 501; body = { error: "Endpoint not modeled" }; }
	} else if (mode?.startsWith("project-start")) {
		const task = { id: "todo-project", name: "Todo project", parent: null, list: { id: listId }, status: { status: projectStarted ? "in progress" : "to do" } };
		if (url.pathname === "/test/reset") {
			projectStarted = false;
			projectWrites = 0;
			body = {};
		} else if (url.pathname === "/test/writes") {
			body = { writes: projectWrites };
		} else if (url.pathname === `/api/v2/list/${listId}/task`) {
			if (url.searchParams.get("statuses[]") === "complete") {
				const page = url.searchParams.get("page");
				const done = { ...task, id: "done-project", name: "Completed project", status: { status: "complete" } };
				if (url.searchParams.get("include_closed") !== "true") { status = 400; body = { error: "Closed tasks must be included" }; }
				else if (mode === "project-start-rate-limit") { status = 429; body = {}; }
				else body = { tasks: page === "0" ? [done, { ...done, id: "done-child", parent: done.id }] : [{ ...done, id: "done-project-2" }], last_page: page === "1" };
			} else {
			const matches = url.searchParams.get("statuses[]") === task.status.status;
			body = { tasks: matches ? (url.searchParams.get("page") === "0" ? [task] : [{ ...task, id: "child", parent: task.id }]) : [], last_page: url.searchParams.get("page") === "1" || !matches };
			}
		} else if (req.method === "GET" && url.pathname.startsWith("/api/v2/task/")) {
			const id = url.pathname.split("/").pop();
			body = { ...task, id,
				...(id === "child" ? { parent: task.id } : {}),
				...(id === "foreign" ? { list: { id: "other-list" } } : {}),
				...(id === "done" ? { status: { status: "complete" } } : {}),
			};
		} else if (req.method === "PUT" && url.pathname === "/api/v2/task/todo-project") {
			if (mode === "project-start-rate-limit") {
				status = 429;
				body = { error: "Rate limited" };
			} else if (req.body?.status !== "in progress" || Object.keys(req.body).length !== 1) {
				status = 400;
				body = { error: "Invalid task update" };
			} else {
				projectStarted = true;
				projectWrites += 1;
				body = { ...task, status: { status: "in progress" } };
			}
		} else {
			status = 501;
			body = { error: "Endpoint not modeled" };
		}
	} else if (req.method !== "GET") {
		status = 501;
		body = { error: "Unexpected mutation" };
	} else if (mode?.startsWith("home") && url.pathname === "/api/v2/user") {
		body = { user: { id: "local-admin" } };
	} else if (mode?.startsWith("home") && url.pathname.endsWith("/members")) {
		body = { data: [
			{ id: "local-admin", username: "Admin" },
			{ id: "budi", username: "Budi Contoh" },
			{ id: "rudi", username: "Rudi Contoh" },
			{ id: "dewi", username: "Dewi Contoh" },
			{ id: "agus", username: "Agus Contoh" },
			{ id: "sari", username: "Sari Contoh" },
		] };
	} else if (mode?.startsWith("home") && url.pathname === `/api/v2/list/${listId}/task`) {
		status = mode === "home-error" ? 503 : 200;
		body = mode === "home-empty" ? { tasks: [], last_page: true } : { tasks: [{ id: "project", name: "Project" }], last_page: true };
	} else if (url.pathname === "/api/v2/task/project/time_in_status") {
		body = { current_status: { status: "in progress", total_time: { by_minute: 60, since: "1000" } } };
	} else if (url.pathname === "/api/v2/task/project") {
		body = { id: "project", name: mode === "renamed" ? "Updated project" : "Project", list: { id: listId } };
	} else if (url.pathname === "/api/v2/team/90182186539/task") {
		if (url.searchParams.get("parent") !== "project" ||
			url.searchParams.get("subtasks") !== "true" ||
			url.searchParams.get("include_closed") !== "true") {
			status = 400;
			body = { error: "Invalid hierarchy query" };
		} else if (url.searchParams.get("page") === "0") {
			body = { tasks: [{ id: "group", parent: "project", name: "Group" }, component("one", "22619cd5-078e-4b12-a6d2-96d723eed52b")], last_page: false };
		} else if (mode === "rate-limit") {
			status = 429;
			body = { error: "Rate limited" };
		} else {
			body = { tasks: [component("two", "dc6eef4c-6843-4043-9938-b14388511be0")], last_page: true };
		}
	} else {
		status = 501;
		body = { error: "Endpoint not modeled" };
	}
	const respond = () => {
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify(body));
	};
	if (mode === "home-slow" && url.pathname.endsWith("/time_in_status")) setTimeout(respond, 2000);
	else respond();
}).listen(process.env.PORT);
