import { redirect } from "next/navigation";
import { MemberActivityPage } from "@/features/member/MemberActivityPage";
import { getPpicScanHistory } from "@/lib/db";
import { clickUpUserId, getAppSession } from "@/lib/session";

const MemberActivity = async ({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) => {
	const session = await getAppSession();
	if (!session) redirect(await clickUpUserId() ? "/unauthorized" : "/login");
	const activeTab =
		(await searchParams).tab === "activity" ? "activity" : "summary";
	const history =
		activeTab === "activity" ? await getPpicScanHistory(session.user_id) : [];
	return <MemberActivityPage history={history} activeTab={activeTab} />;
};

export default MemberActivity;
