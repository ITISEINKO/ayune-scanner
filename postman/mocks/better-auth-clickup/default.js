const http = require("node:http");
http.createServer((req, res) => {
	const path = new URL(req.url, "http://localhost").pathname;
	let status = 200;
	let body;
	if (req.method === "POST" && path === "/api/v2/oauth/token") body = { access_token: "synthetic-clickup-token" };
	else if (req.method === "GET" && path === "/api/v2/user") body = { user: { id: "123", email: "member@example.test", username: "Member" } };
	else if (req.method === "GET" && path === "/api/v2/team") body = { teams: [{ id: "team" }] };
	else if (req.method === "GET" && path === "/api/v3/workspaces/team/chat/channels/channel/members") body = { members: [{ id: "123", username: "Member" }] };
	else if (req.method === "GET" && /^\/api\/v2\/list\/[^/]+\/task$/.test(path) && req.headers.authorization === "synthetic-clickup-token") body = { tasks: [] };
	else { status = 501; body = { error: "Endpoint not modeled" }; }
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}).listen(process.env.PORT);
