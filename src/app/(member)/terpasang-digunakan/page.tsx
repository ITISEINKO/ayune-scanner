import { MemberScannerPage } from "@/features/member/MemberScannerPage";
import {
	ppicSession,
	requirePpicStatusAccess,
	requireSelectedMemberProject,
} from "@/lib/session";

const TerpasangDigunakan = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("TERPASANG_DIGUNAKAN");
	const allowedStatuses = (await ppicSession())?.allowed_status ?? [];
	return <MemberScannerPage project={project} allowedStatuses={allowedStatuses} />;
};

export default TerpasangDigunakan;
