import { UserDetailPage } from "@/features/profile/UserDetailPage";
import { getPpicAccess, getPpicScanHistory } from "@/lib/db";
import { getAppSession, requireSuperAdmin } from "@/lib/session";

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
	const history = await getPpicScanHistory(memberId).catch(() => null);
	return (
		<UserDetailPage
			memberId={memberId}
			canManageAdmin={canManageAdmin}
			history={history}
		/>
	);
}
