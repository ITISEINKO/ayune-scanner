import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clickUpHeaders } from "@/lib/clickup";
import {
	PANEL_CHAT_CHANNEL_ID,
	PANEL_CHAT_WORKSPACE_ID,
} from "@/lib/produksiPanel";
import type { PanelMember } from "@/types/clickup";

type ClickUpUserResponse = {
	user?: { id?: string | number };
	id?: string | number;
};

export type PanelMembersResult =
	| { ok: true; members: PanelMember[] }
	| { ok: false; status: 401 | 403 | 502 };

export const clickUpToken = async () =>
	(await cookies()).get("clickup_access_token")?.value ?? null;

const clickUpUserIdForToken = async (token: string) => {
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
};

export const clickUpUserId = async () => {
	const token = await clickUpToken();
	return token ? clickUpUserIdForToken(token) : null;
};

export const panelChannelMembers = async (): Promise<PanelMembersResult> => {
	const token = await clickUpToken();
	if (!token) return { ok: false, status: 401 };
	const workspaceId =
		process.env.CLICKUP_CHAT_WORKSPACE_ID || PANEL_CHAT_WORKSPACE_ID;
	const channelId =
		process.env.CLICKUP_CHAT_CHANNEL_ID ||
		process.env.CLICKUP_PPIC_CHANNEL_ID ||
		PANEL_CHAT_CHANNEL_ID;
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
		if (!members.some((member) => member.id === userId))
			return { ok: false, status: 403 };
		const superAdminIds = new Set(
			(
				process.env.CLICKUP_SUPERADMIN_IDS ??
				process.env.CLICKUP_SUPERADMIN_IDs ??
				process.env.CLICKUP_SUPERADMIN_ID ??
				""
			)
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean),
		);
		return superAdminIds.has(userId)
			? { ok: true, members }
			: { ok: false, status: 403 };
	} catch {
		return { ok: false, status: 502 };
	}
};

export const requireClickUpToken = async () => {
	if (!(await clickUpToken())) redirect("/login");
};
