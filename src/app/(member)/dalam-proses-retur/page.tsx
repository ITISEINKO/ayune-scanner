import { MemberScannerPage } from "@/features/member/MemberScannerPage";
import {
	getAppSession,
	requirePpicStatusAccess,
	requireSelectedMemberProject,
} from "@/lib/session";

const Packing = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("DALAM_PROSES_RETUR");
	const allowedStatuses = (await getAppSession())?.allowed_status ?? [];
	return (
		<MemberScannerPage project={project} allowedStatuses={allowedStatuses} />
	);
};

export default Packing;
