import { MemberScannerPage } from "@/features/member/MemberScannerPage";
import {
	getAppSession,
	requirePpicStatusAccess,
	requireSelectedMemberProject,
} from "@/lib/session";

const TerpasangDigunakan = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("TERPASANG_DIGUNAKAN");
	const allowedStatuses = (await getAppSession())?.allowed_status ?? [];
	return <MemberScannerPage project={project} allowedStatuses={allowedStatuses} />;
};

export default TerpasangDigunakan;
