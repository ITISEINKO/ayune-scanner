import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
	deactivatePpicPermission,
	getPpicPermission,
	getPpicRole,
	isPpicRole,
	isPpicSuperAdmin,
	savePpicMemberNames,
	savePpicPermission,
	savePpicRole,
} from "@/lib/db";
import { ppicStatuses } from "@/types/ppic";
import { getAbly } from "@/lib/ably";
import {
	clickUpUserId,
	panelChannelMembers,
	PANEL_MEMBERS_CACHE_TAG,
} from "@/lib/session";

const accessError = (status: 401 | 403 | 502) =>
	NextResponse.json(
		{
			ok: false,
			error:
				status === 403
					? "CHANNEL_MEMBER_REQUIRED"
					: status === 401
						? "UNAUTHORIZED"
						: "CLICKUP_ERROR",
		},
		{ status },
	);

export async function GET() {
	const result = await panelChannelMembers();
	if (!result.ok) return accessError(result.status);
	try {
		const [, roles, permissions] = await Promise.all([
			savePpicMemberNames(result.members),
			Object.fromEntries(
				await Promise.all(
					result.members.map(async (member) => [
						member.id,
						await getPpicRole(member.id),
					]),
				),
			),
			Object.fromEntries(
				await Promise.all(
					result.members.map(async (member) => [
						member.id,
						(await getPpicPermission(member.id))?.allowed_status ?? null,
					]),
				),
			),
		]);
		return NextResponse.json({ ...result, roles, permissions });
	} catch {
		return NextResponse.json(
			{ ok: false, error: "DATABASE_ERROR" },
			{ status: 502 },
		);
	}
}

export async function POST(request: Request) {
	const result = await panelChannelMembers();
	if (!result.ok) return accessError(result.status);

	let body: { user_id?: unknown; role?: unknown; allowed_status?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return NextResponse.json(
			{ ok: false, error: "INVALID_PERMISSION" },
			{ status: 400 },
		);
	}
	const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
	const member = result.members.find((candidate) => candidate.id === userId);
	const isRoleUpdate = body.role !== undefined;
	const isStatusUpdate = body.allowed_status !== undefined;
	const role = isPpicRole(body.role) ? body.role : null;
	const allowedStatus =
		body.allowed_status === null
			? null
			: ppicStatuses(body.allowed_status)
				? ppicStatuses(body.allowed_status)
				: undefined;
	if (
		!userId ||
		isRoleUpdate === isStatusUpdate ||
		(isRoleUpdate && role === null) ||
		(isStatusUpdate && allowedStatus === undefined) ||
		!member ||
		(isStatusUpdate && (await isPpicSuperAdmin(userId)))
	)
		return NextResponse.json(
			{ ok: false, error: "INVALID_PERMISSION" },
			{ status: 400 },
		);

	const updatedBy = await clickUpUserId();
	if (!updatedBy) return accessError(401);
	try {
		if (isRoleUpdate) await savePpicRole(userId, role!, updatedBy);
		else if (allowedStatus === null)
			await deactivatePpicPermission(userId, updatedBy);
		else await savePpicPermission(userId, allowedStatus!, updatedBy);
		await savePpicMemberNames([member]);
	} catch {
		return NextResponse.json(
			{ ok: false, error: "DATABASE_ERROR" },
			{ status: 502 },
		);
	}
	revalidateTag(PANEL_MEMBERS_CACHE_TAG, { expire: 0 });
	try {
		const event = {
			userId,
			...(isRoleUpdate
				? { role, allowedStatus: null }
				: { allowedStatus }),
		};
		const channels = getAbly().channels;
		await Promise.all([
			channels.get("ppic:settings").publish("member-updated", event),
			channels
				.get(`ppic:member:${userId}`)
				.publish("session-updated", { userId }),
		]);
	} catch (error) {
		console.error("Ably settings update failed", error);
	}
	return NextResponse.json({ ok: true });
}
