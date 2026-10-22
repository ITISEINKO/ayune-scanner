// Synthetic fixtures follow the ClickUp task/custom-field contract used by the dashboard.
const http = require("node:http");
const listId = "1100830000000087";
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
	if (req.method !== "GET") {
		status = 501;
		body = { error: "Unexpected mutation" };
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
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}).listen(process.env.PORT);
