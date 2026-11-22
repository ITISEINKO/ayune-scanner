import { cookies, headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clickUpHeaders } from "@/lib/clickup";
import { canImportLby, db, getPpicAccess, isPpicStatus, isPpicSuperAdmin } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
	CLICKUP_TEAM_ID,
	CLICKUP_PPIC_CHANNEL_ID,
	ppicStatusPath,
} from "@/lib/produksiPanel";
import { hasPpicAdminAccess } from "@/types/ppic";
import type { PanelMember } from "@/types/clickup";
import type { SelectedProject } from "@/types/project";

export const SESSION_COOKIE = "ppic_session";
export const PPIC_SELECTED_PROJECT_COOKIE = "ppic_selected_project";
export const SESSION_REFRESH_TTL_MS = 15 * 60 * 1000;
export const PANEL_MEMBERS_CACHE_TAG = "panel-members";

type ClickUpUserResponse = {
	user?: { id?: string | number };
	id?: string | number;
};

export type PanelMembersResult =
	| { ok: true; members: PanelMember[] }
	| { ok: false; status: 401 | 403 | 502 };

export const clickUpToken = async () => {
	const identity = await getClickUpIdentity();
	if (!identity || !(await getAppSession())) return null;
	try {
		const result = await auth.api.getAccessToken({
			body: { accountId: identity.account_id },
			headers: await headers(),
		});
		return result.accessToken ?? null;
	} catch {
		return null;
	}
};

export const clickUpUserIdForToken = cache(async (token: string) => {
	try {
		const response = await fetch("https://api.clickup.com/api/v2/user", {
			headers: clickUpHeaders(token),
			cache: "no-store",
		});
		if (!response.ok) return null;
		const body = (await response.json()) as ClickUpUserResponse;
		const id = body.user?.id ?? body.id;
		return id === undefined || id === null ? null : String(id);
	} catch {
		return null;
	}
});

export const clickUpUserId = async () => {
	return (await getClickUpIdentity())?.user_id ?? null;
};

const sessionSignature = (payload: string) =>
	process.env.CLICKUP_CLIENT_SECRET
		? createHmac("sha256", process.env.CLICKUP_CLIENT_SECRET)
				.update(payload)
				.digest("base64url")
		: null;

export const encodeSelectedProject = (
	userId: string,
	project: SelectedProject,
) => {
	const payload = Buffer.from(
		JSON.stringify({ user_id: userId, ...project }),
	).toString("base64url");
	const signature = sessionSignature(payload);
	return signature ? `${payload}.${signature}` : null;
};

export const selectedProject = async (
	userId: string,
): Promise<SelectedProject | null> => {
	const value = (await cookies()).get(PPIC_SELECTED_PROJECT_COOKIE)?.value;
	if (!value) return null;
	const [payload, signature] = value.split(".");
	const expected = payload ? sessionSignature(payload) : null;
	if (!signature || !expected) return null;
	const actualBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (
		actualBuffer.length !== expectedBuffer.length ||
		!timingSafeEqual(actualBuffer, expectedBuffer)
	)
		return null;
	try {
		const selected = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as { user_id?: unknown } & Partial<SelectedProject>;
		return selected.user_id === userId &&
			typeof selected.task_id === "string" &&
			(typeof selected.name === "string" || selected.name === null) &&
			(typeof selected.custom_id === "string" || selected.custom_id === null)
			? {
					task_id: selected.task_id,
					name: selected.name,
					custom_id: selected.custom_id,
				}
			: null;
	} catch {
		return null;
	}
};

export const selectedProjectTaskId = async (userId: string) =>
	(await selectedProject(userId))?.task_id ?? null;

export const getClickUpIdentity = async () => {
	const current = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
	if (!current) return null;
	const accounts = await db.execute({
		sql: 'SELECT id, "accountId" FROM account WHERE "userId" = ? AND "providerId" = ?',
		args: [current.user.id, "clickup"],
	});
	if (accounts.rows.length !== 1) return null;
	return { user_id: String(accounts.rows[0].accountId), account_id: String(accounts.rows[0].id), refreshed_at: current.session.updatedAt.getTime() };
};

export const getAppSession = async () => {
	const identity = await getClickUpIdentity();
	if (!identity) return null;
	const state = await getAuthorizationState(identity.user_id);
	return state.path === "/unauthorized" ? null : {
		...identity,
		role: state.role,
		allowed_status: state.allowed_status,
		can_import_lby: state.can_import_lby,
	};
};

export const getAuthorizationState = async (userId: string) => {
	const access = await getPpicAccess(userId);
	if (hasPpicAdminAccess(access?.role))
		return {
			role: access.role,
			allowed_status: null,
			path: "/admin",
			can_import_lby: false,
		};
	const allowedStatus =
		access?.role === "MEMBER" &&
		Number(access.active) === 1 &&
		Array.isArray(access.allowed_status)
			? access.allowed_status
			: null;
	const importer = await canImportLby(userId);
	if (!importer && (!allowedStatus || access?.role !== "MEMBER"))
		return {
			role: "MEMBER" as const,
			allowed_status: null,
			can_import_lby: false,
			path: "/unauthorized",
		};
	return {
		role: "MEMBER" as const,
		allowed_status: allowedStatus,
		can_import_lby: importer,
		path: importer ? "/drafter" : "/projects",
	};
};

export const postLoginPathForUser = async (userId: string) =>
	(await getAuthorizationState(userId)).path;

export const postLoginPath = async () => {
	const session = await getAppSession();
	if (session) return hasPpicAdminAccess(session.role) ? "/admin" : session.can_import_lby ? "/drafter" : "/projects";
	const userId = await clickUpUserId();
	if (!userId) return "/login";
	const path = await postLoginPathForUser(userId);
	return path === "/unauthorized" ? "/profile" : path;
};

export const requireFreshSuperAdmin = async () => {
	const userId = (await getClickUpIdentity())?.user_id;
	if (!userId) redirect("/login");
	if (!(await isPpicSuperAdmin(userId)))
		redirect((await getAuthorizationState(userId)).path === "/unauthorized" ? "/profile" : "/unauthorized");
	return userId;
};

export const requireSuperAdmin = async () => {
	const session = await getAppSession();
	if (!session) redirect(await getClickUpIdentity() ? "/profile" : "/login");
	if (!hasPpicAdminAccess(session.role)) redirect("/unauthorized");
};

export const requireFreshPpicStatusAccess = async (status: string) => {
	if (!isPpicStatus(status)) redirect("/unauthorized");
	const userId = (await getClickUpIdentity())?.user_id;
	if (!userId) redirect("/login");
	if ((await getAuthorizationState(userId)).path === "/unauthorized") redirect("/profile");
	const access = await getPpicAccess(userId);
	if (hasPpicAdminAccess(access?.role)) return userId;
	if (
		access?.role !== "MEMBER" ||
		Number(access.active) !== 1 ||
		!Array.isArray(access.allowed_status) ||
		!access.allowed_status.includes(status)
	)
		redirect("/unauthorized");
	return userId;
};

export const requirePpicStatusAccess = async (status: string) => {
	if (!isPpicStatus(status)) redirect("/unauthorized");
	const session = await getAppSession();
	if (session) {
		if (
			hasPpicAdminAccess(session.role) ||
			session.allowed_status?.includes(status)
		)
			return;
		redirect("/unauthorized");
	}
	await requireFreshPpicStatusAccess(status);
};

export const requireSelectedMemberProject = async () => {
	const session = await getAppSession();
	if (!session) redirect(await getClickUpIdentity() ? "/profile" : "/login");
	if (session.role !== "MEMBER") redirect("/unauthorized");
	const project = await selectedProject(session.user_id);
	if (!project) redirect("/projects");
	return project;
};

export const requireSelectedAdminProject = async () => {
	const session = await getAppSession();
	const userId =
		hasPpicAdminAccess(session?.role) ? session.user_id : await clickUpUserId();
	if (!userId) redirect("/login");
	if (!hasPpicAdminAccess(session?.role) && !(await isPpicSuperAdmin(userId)))
		redirect("/unauthorized");
	const project = await selectedProject(userId);
	if (!project) redirect("/admin/projects");
	return project;
};

const panelChannelMembersUrl = () => {
	const workspaceId =
		process.env.CLICKUP_CHAT_WORKSPACE_ID ||
		process.env.CLICKUP_TEAM_ID ||
		CLICKUP_TEAM_ID;
	const channelId =
		process.env.CLICKUP_CHAT_CHANNEL_ID ||
		process.env.CLICKUP_PPIC_CHANNEL_ID ||
		CLICKUP_PPIC_CHANNEL_ID;
	return `https://api.clickup.com/api/v3/workspaces/${workspaceId}/chat/channels/${channelId}/members`;
};

const fetchPanelChannelMembers = async (token: string): Promise<PanelMember[]> => {
	const response = await fetch(panelChannelMembersUrl(), {
		headers: clickUpHeaders(token),
		cache: "no-store",
	});
	if (!response.ok)
		throw new Error(`CHANNEL_MEMBERS_UNAVAILABLE:${response.status}`);
	const body = (await response.json()) as {
		data?: unknown;
		members?: unknown;
	};
	const rawMembers = body.data ?? body.members;
	if (!Array.isArray(rawMembers))
		throw new Error("INVALID_CHANNEL_MEMBERS_RESPONSE");
	return rawMembers.flatMap((member) => {
		if (typeof member !== "object" || member === null) return [];
		const value = member as Record<string, unknown>;
		const id = value.id;
		const name = value.username ?? value.name;
		return id !== undefined && typeof name === "string"
			? [{ id: String(id), name }]
			: [];
	});
};

export const isPpicChannelMember = async (token: string, userId: string) =>
	(await fetchPanelChannelMembers(token)).some((member) => member.id === userId);

const cachedPanelChannelMembers = unstable_cache(
	async (token: string): Promise<PanelMembersResult> => {
		try {
			const [userId, members] = await Promise.all([
				clickUpUserIdForToken(token),
				fetchPanelChannelMembers(token),
			]);
			if (!userId) return { ok: false, status: 401 };
			return (await isPpicSuperAdmin(userId))
				? { ok: true, members }
				: { ok: false, status: 403 };
		} catch {
			return { ok: false, status: 502 };
		}
	},
	["panel-channel-members"],
	{ revalidate: 60, tags: [PANEL_MEMBERS_CACHE_TAG] },
);

export const panelChannelMembers = async (token?: string): Promise<PanelMembersResult> => {
	token ??= (await clickUpToken()) ?? undefined;
	return token ? cachedPanelChannelMembers(token) : { ok: false, status: 401 };
};

export const requireClickUpToken = async () => {
	if (!(await clickUpToken())) redirect("/login");
};
