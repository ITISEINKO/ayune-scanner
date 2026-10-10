import { MemberScannerPage } from "@/features/member/MemberScannerPage";
import { getPpicAccess } from "@/lib/db";
import {
	requireFreshPpicStatusAccess,
	requireSelectedMemberProject,
} from "@/lib/session";

const TerpasangDigunakan = async () => {
	const project = await requireSelectedMemberProject();
	const userId = await requireFreshPpicStatusAccess("TERPASANG_DIGUNAKAN");
	const allowedStatuses = (await getPpicAccess(userId))?.allowed_status ?? [];
	return <MemberScannerPage project={project} allowedStatuses={allowedStatuses} />;
};

export default TerpasangDigunakan;
