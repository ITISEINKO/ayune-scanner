import { UserDetailPage } from "@/features/profile/UserDetailPage";
import { getPpicAccess, getPpicScanHistory } from "@/lib/db";
import { getAppSession, requireSuperAdmin } from "@/lib/session";
import { MEMBER_ACTIVITY_PAGE_SIZE } from "@/types/ppic";

export default async function UserDetail({
	params,
}: {
	params: Promise<{ "user-id": string }>;
}) {
	await requireSuperAdmin();
	const { "user-id": memberId } = await params;
	const session = await getAppSession();
	const canManageAdmin =
		session?.role === "ADMIN" &&
		(await getPpicAccess(session.user_id))?.role === "ADMIN";
	const rows = await getPpicScanHistory(memberId, MEMBER_ACTIVITY_PAGE_SIZE + 1).catch(() => null);
	const history = rows?.slice(0, MEMBER_ACTIVITY_PAGE_SIZE) ?? null;
	return (
		<UserDetailPage
			key={memberId}
			memberId={memberId}
			canManageAdmin={canManageAdmin}
			history={history}
			hasMoreHistory={Boolean(rows && rows.length > MEMBER_ACTIVITY_PAGE_SIZE)}
		/>
	);
}
