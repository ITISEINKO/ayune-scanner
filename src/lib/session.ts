import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clickUpHeaders } from "@/lib/clickup";
import {
	getPpicPermission,
	isPpicStatus,
	isPpicSuperAdmin,
} from "@/lib/db";
import {
	CLICKUP_TEAM_ID,
	CLICKUP_PPIC_CHANNEL_ID,
	ppicStatusPath,
} from "@/lib/produksiPanel";
import type { PpicRole, PpicStatus } from "@/types/ppic";
import type { PanelMember } from "@/types/clickup";

export const PPIC_SESSION_COOKIE = "ppic_session";

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

const sessionSignature = (payload: string) =>
	process.env.CLICKUP_CLIENT_SECRET
		? createHmac("sha256", process.env.CLICKUP_CLIENT_SECRET)
				.update(payload)
				.digest("base64url")
		: null;

export const encodePpicSession = (
	role: PpicRole,
	allowedStatus: PpicStatus | null,
) => {
	const payload = Buffer.from(
		JSON.stringify({ role, allowed_status: allowedStatus }),
	).toString("base64url");
	const signature = sessionSignature(payload);
	return signature ? `${payload}.${signature}` : null;
};

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
		) as { role?: unknown; allowed_status?: unknown };
		if (session.role === "SUPER_ADMIN")
			return { role: "SUPER_ADMIN" as const, allowed_status: null };
		if (
			session.role === "MEMBER" &&
			(session.allowed_status === null || isPpicStatus(session.allowed_status))
		)
			return {
				role: "MEMBER" as const,
				allowed_status: session.allowed_status,
			};
	} catch {
		return null;
	}
	return null;
};

export const ppicLoginState = async (userId: string) => {
	if (await isPpicSuperAdmin(userId))
		return {
			role: "SUPER_ADMIN" as const,
			allowed_status: null,
			path: "/settings",
		};
	const allowedStatus = (await getPpicPermission(userId))?.allowed_status;
	return {
		role: "MEMBER" as const,
		allowed_status: isPpicStatus(allowedStatus) ? allowedStatus : null,
		path: ppicStatusPath(allowedStatus),
	};
};

export const postLoginPathForUser = async (userId: string) =>
	(await ppicLoginState(userId)).path;

export const postLoginPath = async () => {
	const session = await ppicSession();
	if (session)
		return session.role === "SUPER_ADMIN"
			? "/settings"
			: ppicStatusPath(session.allowed_status);
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
	const userId = await clickUpUserId();
	if (!userId) redirect("/login");
	if (await isPpicSuperAdmin(userId)) return;
	if ((await getPpicPermission(userId))?.allowed_status !== status)
		redirect("/unauthorized");
};

export const requirePpicStatusAccess = async (status: string) => {
	if (!isPpicStatus(status)) redirect("/unauthorized");
	const session = await ppicSession();
	if (session) {
		if (
			session.role === "SUPER_ADMIN" ||
			session.allowed_status === status
		)
			return;
		redirect("/unauthorized");
	}
	await requireFreshPpicStatusAccess(status);
};

export const panelChannelMembers = async (): Promise<PanelMembersResult> => {
	const token = await clickUpToken();
	if (!token) return { ok: false, status: 401 };
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
};

export const requireClickUpToken = async () => {
	if (!(await clickUpToken())) redirect("/login");
};
