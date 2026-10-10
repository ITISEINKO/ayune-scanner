import { HistoryMemberPage } from "@/features/member/HistoryMemberPage";
import { getPpicScanHistory } from "@/lib/db";
import { clickUpUserId, ppicSession, requireClickUpToken } from "@/lib/session";

const HistoryMember = async () => {
	await requireClickUpToken();
	const userId = (await ppicSession())?.user_id ?? (await clickUpUserId());
	return <HistoryMemberPage history={userId ? await getPpicScanHistory(userId) : []} />;
};

export default HistoryMember;
