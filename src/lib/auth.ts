import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { clickUpHeaders } from "@/lib/clickup";
import { CLICKUP_PPIC_CHANNEL_ID, CLICKUP_TEAM_ID } from "@/lib/produksiPanel";

export const auth = betterAuth({
	database: drizzleAdapter(drizzle(db, { schema }), { provider: "sqlite", schema }),
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	session: { expiresIn: 9 * 60 * 60, cookieCache: { enabled: false } },
	user: { additionalFields: {
		role: { type: "string", input: false, defaultValue: "MEMBER" },
		allowedStatus: { type: "string", input: false, required: false },
		active: { type: "boolean", input: false, defaultValue: false },
		canImportLby: { type: "boolean", input: false, defaultValue: false },
		permissionUpdatedBy: { type: "string", input: false, required: false },
		permissionUpdatedAt: { type: "string", input: false, required: false },
	} },
	plugins: [genericOAuth({ config: [{
		providerId: "clickup",
		clientId: process.env.CLICKUP_CLIENT_ID ?? "",
		clientSecret: process.env.CLICKUP_CLIENT_SECRET,
		authorizationUrl: "https://app.clickup.com/api",
		tokenUrl: "https://api.clickup.com/api/v2/oauth/token",
		redirectURI: process.env.CLICKUP_REDIRECT_URI,
		disableSignUp: true,
		pkce: false,
		getToken: async ({ code, redirectURI }) => {
			const response = await fetch("https://api.clickup.com/api/v2/oauth/token", {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ client_id: process.env.CLICKUP_CLIENT_ID, client_secret: process.env.CLICKUP_CLIENT_SECRET, code, redirect_uri: redirectURI }),
			});
			if (!response.ok) throw new Error("ClickUp token exchange failed");
			const data = await response.json() as { access_token?: unknown };
			if (typeof data.access_token !== "string" || !data.access_token) throw new Error("ClickUp token missing");
			return { accessToken: data.access_token };
		},
		getUserInfo: async ({ accessToken }) => {
			if (!accessToken) return null;
			const workspaceId = process.env.CLICKUP_CHAT_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || CLICKUP_TEAM_ID;
			const channelId = process.env.CLICKUP_CHAT_CHANNEL_ID || process.env.CLICKUP_PPIC_CHANNEL_ID || CLICKUP_PPIC_CHANNEL_ID;
			const headers = clickUpHeaders(accessToken);
			const [profileResponse, teamsResponse, membersResponse] = await Promise.all([
				fetch("https://api.clickup.com/api/v2/user", { headers, cache: "no-store" }),
				fetch("https://api.clickup.com/api/v2/team", { headers, cache: "no-store" }),
				fetch(`https://api.clickup.com/api/v3/workspaces/${workspaceId}/chat/channels/${channelId}/members`, { headers, cache: "no-store" }),
			]);
			if (!profileResponse.ok || !teamsResponse.ok || !membersResponse.ok) return null;
			const profile = await profileResponse.json() as { user?: { id?: string | number; email?: string; username?: string; name?: string } };
			const { teams } = await teamsResponse.json() as { teams?: { id?: string | number }[] };
			const members = await membersResponse.json() as { data?: { id?: string | number }[]; members?: { id?: string | number }[] };
			const user = profile.user;
			if (user?.id == null || !user.email || !Array.isArray(teams) || !teams.some((team) => String(team.id) === process.env.CLICKUP_TEAM_ID)) return null;
			const list = members.data ?? members.members;
			if (!Array.isArray(list) || !list.some((member) => String(member.id) === String(user.id))) return null;
			const access = await db.execute({ sql: 'SELECT u.role, u.active, u.allowed_status, u.can_import_lby FROM "user" u JOIN account a ON a."userId" = u.id WHERE a."providerId" = ? AND a."accountId" = ?', args: ["clickup", String(user.id)] });
			const row = access.rows[0];
			if (!row) return null;
			return { id: String(user.id), email: user.email, name: user.username || user.name || user.email, emailVerified: false };
		},
	}] })],
});
