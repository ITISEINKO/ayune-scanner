import { NextResponse } from "next/server";
import {
	deactivatePpicPermission,
	getPpicPermission,
	isPpicStatus,
	savePpicPermission,
} from "@/lib/db";
import { clickUpUserId, panelChannelMembers } from "@/lib/session";

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
		const permissions = Object.fromEntries(
			await Promise.all(
				result.members.map(async (member) => [
					member.id,
					(await getPpicPermission(member.id))?.allowed_status ?? null,
				]),
			),
		);
		return NextResponse.json({ ...result, permissions });
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

	let body: { user_id?: unknown; allowed_status?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return NextResponse.json(
			{ ok: false, error: "INVALID_PERMISSION" },
			{ status: 400 },
		);
	}
	const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
	if (
		!userId ||
		(body.allowed_status !== null && !isPpicStatus(body.allowed_status)) ||
		!result.members.some((member) => member.id === userId)
	)
		return NextResponse.json(
			{ ok: false, error: "INVALID_PERMISSION" },
			{ status: 400 },
		);

	const updatedBy = await clickUpUserId();
	if (!updatedBy) return accessError(401);
	try {
		if (body.allowed_status === null)
			await deactivatePpicPermission(userId, updatedBy);
		else await savePpicPermission(userId, body.allowed_status, updatedBy);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json(
			{ ok: false, error: "DATABASE_ERROR" },
			{ status: 502 },
		);
	}
}
