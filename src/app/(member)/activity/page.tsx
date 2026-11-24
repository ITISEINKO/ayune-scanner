import { redirect } from "next/navigation";
import { MemberActivityPage } from "@/features/member/MemberActivityPage";
import { getPpicScanHistory } from "@/lib/db";
import { clickUpUserId, getAppSession } from "@/lib/session";
import { MEMBER_ACTIVITY_PAGE_SIZE } from "@/types/ppic";

const MemberActivity = async ({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) => {
	const session = await getAppSession();
	if (!session) redirect(await clickUpUserId() ? "/unauthorized" : "/login");
	const activeTab =
		(await searchParams).tab === "activity" ? "activity" : "summary";
	const rows = activeTab === "activity"
		? await getPpicScanHistory(session.user_id, MEMBER_ACTIVITY_PAGE_SIZE + 1)
		: [];
	return (
		<MemberActivityPage
			key={activeTab}
			history={rows.slice(0, MEMBER_ACTIVITY_PAGE_SIZE)}
			initialHasMore={rows.length > MEMBER_ACTIVITY_PAGE_SIZE}
			activeTab={activeTab}
		/>
	);
};

export default MemberActivity;
