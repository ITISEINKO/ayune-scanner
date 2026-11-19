import { MemberScannerPage } from "@/features/member/MemberScannerPage";
import {
	ppicSession,
	requirePpicStatusAccess,
	requireSelectedMemberProject,
} from "@/lib/session";

const Packing = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("SEDANG_DIPACKING");
	const allowedStatuses = (await ppicSession())?.allowed_status ?? [];
	return <MemberScannerPage project={project} allowedStatuses={allowedStatuses} />;
};

export default Packing;
