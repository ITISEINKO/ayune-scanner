import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clickUpHeaders } from "@/lib/clickup";
import { getPpicAccess, isPpicStatus, isPpicSuperAdmin } from "@/lib/db";
import {
	CLICKUP_TEAM_ID,
	CLICKUP_PPIC_CHANNEL_ID,
	ppicStatusPath,
} from "@/lib/produksiPanel";
import { ppicStatuses } from "@/types/ppic";
import type { PpicRole, PpicStatuses } from "@/types/ppic";
import type { PanelMember } from "@/types/clickup";
import type { SelectedProject } from "@/types/project";

export const PPIC_SESSION_COOKIE = "ppic_session";
export const PPIC_SELECTED_PROJECT_COOKIE = "ppic_selected_project";
export const PPIC_SESSION_REFRESH_TTL_MS = 15 * 60 * 1000;
export const PANEL_MEMBERS_CACHE_TAG = "panel-members";

type ClickUpUserResponse = {
	user?: { id?: string | number };
	id?: string | number;
};

export type PanelMembersResult =
	| { ok: true; members: PanelMember[] }
	| { ok: false; status: 401 | 403 | 502 };

export const clickUpToken = async () =>
	(await cookies()).get("clickup_access_token")?.value ?? null;

const clickUpUserIdForToken = cache(async (token: string) => {
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
	const token = await clickUpToken();
	return token ? clickUpUserIdForToken(token) : null;
};

export const clickUpProfile = async () => {
	const token = await clickUpToken();
	if (!token) return null;
	try {
		const response = await fetch("https://api.clickup.com/api/v2/user", {
			headers: clickUpHeaders(token),
			cache: "no-store",
		});
		if (!response.ok) return null;
		const body = (await response.json()) as {
			user?: { email?: unknown; username?: unknown; name?: unknown };
			email?: unknown;
			username?: unknown;
			name?: unknown;
		};
		const email = body.user?.email ?? body.email;
		const displayName = [
			body.user?.username,
			body.user?.name,
			body.username,
			body.name,
		].find((name) => typeof name === "string" && name.trim());
		return {
			email: typeof email === "string" ? email : null,
			displayName: typeof displayName === "string" ? displayName.trim() : null,
		};
	} catch {
		return null;
	}
};

const sessionSignature = (payload: string) =>
	process.env.CLICKUP_CLIENT_SECRET
		? createHmac("sha256", process.env.CLICKUP_CLIENT_SECRET)
				.update(payload)
				.digest("base64url")
		: null;

export const encodePpicSession = (
	userId: string,
	role: PpicRole,
	allowedStatus: PpicStatuses | null,
) => {
	const payload = Buffer.from(
		JSON.stringify({
			user_id: userId,
			role,
			allowed_status: allowedStatus,
			refreshed_at: Date.now(),
		}),
	).toString("base64url");
	const signature = sessionSignature(payload);
	return signature ? `${payload}.${signature}` : null;
};

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

export const ppicSession = async () => {
	const value = (await cookies()).get(PPIC_SESSION_COOKIE)?.value;
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
		const session = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as {
			user_id?: unknown;
			role?: unknown;
			allowed_status?: unknown;
			refreshed_at?: unknown;
		};
		if (
			typeof session.user_id !== "string" ||
			!session.user_id ||
			typeof session.refreshed_at !== "number" ||
			!Number.isFinite(session.refreshed_at)
		)
			return null;
		if (session.role === "SUPER_ADMIN")
			return {
				user_id: session.user_id,
				role: "SUPER_ADMIN" as const,
				allowed_status: null,
				refreshed_at: session.refreshed_at,
			};
		const allowedStatus =
			session.allowed_status === null
				? null
				: ppicStatuses(session.allowed_status);
		if (session.role === "MEMBER" && allowedStatus)
			return {
				user_id: session.user_id,
				role: "MEMBER" as const,
				allowed_status: allowedStatus,
				refreshed_at: session.refreshed_at,
			};
	} catch {
		return null;
	}
	return null;
};

export const ppicLoginState = async (userId: string) => {
	const access = await getPpicAccess(userId);
	if (access?.role === "SUPER_ADMIN")
		return {
			role: "SUPER_ADMIN" as const,
			allowed_status: null,
			path: "/admin",
		};
	const allowedStatus =
		access?.role === "MEMBER" &&
		Number(access.active) === 1 &&
		Array.isArray(access.allowed_status)
			? access.allowed_status
			: null;
	return {
		role: "MEMBER" as const,
		allowed_status: allowedStatus,
		path: "/projects",
	};
};

export const postLoginPathForUser = async (userId: string) =>
	(await ppicLoginState(userId)).path;

export const postLoginPath = async () => {
	const session = await ppicSession();
	if (session) return session.role === "SUPER_ADMIN" ? "/admin" : "/projects";
	const userId = await clickUpUserId();
	return userId ? postLoginPathForUser(userId) : "/login";
};

export const requireFreshSuperAdmin = async () => {
	const userId = await clickUpUserId();
	if (!userId) redirect("/login");
	if (!(await isPpicSuperAdmin(userId))) redirect("/unauthorized");
};

export const requireSuperAdmin = async () => {
	const session = await ppicSession();
	if (session) {
		if (session.role !== "SUPER_ADMIN") redirect("/unauthorized");
		return;
	}
	await requireFreshSuperAdmin();
};

export const requireFreshPpicStatusAccess = async (status: string) => {
	if (!isPpicStatus(status)) redirect("/unauthorized");
	const userId = (await ppicSession())?.user_id ?? (await clickUpUserId());
	if (!userId) redirect("/login");
	const access = await getPpicAccess(userId);
	if (access?.role === "SUPER_ADMIN") return userId;
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
	const session = await ppicSession();
	if (session) {
		if (
			session.role === "SUPER_ADMIN" ||
			session.allowed_status?.includes(status)
		)
			return;
		redirect("/unauthorized");
	}
	await requireFreshPpicStatusAccess(status);
};

export const requireSelectedMemberProject = async () => {
	const session = await ppicSession();
	if (!session || session.role !== "MEMBER") redirect("/unauthorized");
	const project = await selectedProject(session.user_id);
	if (!project) redirect("/projects");
	return project;
};

export const requireSelectedAdminProject = async () => {
	const session = await ppicSession();
	const userId =
		session?.role === "SUPER_ADMIN" ? session.user_id : await clickUpUserId();
	if (!userId) redirect("/login");
	if (session?.role !== "SUPER_ADMIN" && !(await isPpicSuperAdmin(userId)))
		redirect("/unauthorized");
	const project = await selectedProject(userId);
	if (!project) redirect("/admin/projects");
	return project;
};

const cachedPanelChannelMembers = unstable_cache(
	async (token: string): Promise<PanelMembersResult> => {
		const workspaceId =
			process.env.CLICKUP_CHAT_WORKSPACE_ID ||
			process.env.CLICKUP_TEAM_ID ||
			CLICKUP_TEAM_ID;
		const channelId =
			process.env.CLICKUP_CHAT_CHANNEL_ID ||
			process.env.CLICKUP_PPIC_CHANNEL_ID ||
			CLICKUP_PPIC_CHANNEL_ID;
		const membersUrl = `https://api.clickup.com/api/v3/workspaces/${workspaceId}/chat/channels/${channelId}/members`;

		try {
			const [userId, response] = await Promise.all([
				clickUpUserIdForToken(token),
				fetch(membersUrl, {
					headers: clickUpHeaders(token),
					cache: "no-store",
				}),
			]);
			if (!response.ok)
				return {
					ok: false,
					status: response.status === 401 ? 401 : 502,
				};
			if (!userId) return { ok: false, status: 401 };
			const body = (await response.json()) as {
				data?: unknown;
				members?: unknown;
			};
			const rawMembers = body.data ?? body.members;
			const members = Array.isArray(rawMembers)
				? rawMembers.flatMap((member) => {
						if (typeof member !== "object" || member === null) return [];
						const value = member as Record<string, unknown>;
						const id = value.id;
						const name = value.username ?? value.name;
						return id !== undefined && typeof name === "string"
							? [{ id: String(id), name }]
							: [];
					})
				: [];
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
