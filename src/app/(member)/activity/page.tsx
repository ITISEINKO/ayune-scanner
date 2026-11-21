import { MemberActivityPage } from "@/features/member/MemberActivityPage";
import { getPpicScanHistory } from "@/lib/db";
import {
	clickUpUserId,
	getAppSession,
	requireClickUpToken,
} from "@/lib/session";

const MemberActivity = async ({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) => {
	await requireClickUpToken();
	const activeTab =
		(await searchParams).tab === "activity" ? "activity" : "summary";
	const userId = (await getAppSession())?.user_id ?? (await clickUpUserId());
	const history =
		activeTab === "activity" && userId ? await getPpicScanHistory(userId) : [];
	return <MemberActivityPage history={history} activeTab={activeTab} />;
};

export default MemberActivity;
