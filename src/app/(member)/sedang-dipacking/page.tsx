import { MemberScannerPage } from "@/features/member/MemberScannerPage";
import { getPpicAccess } from "@/lib/db";
import {
	requireFreshPpicStatusAccess,
	requireSelectedMemberProject,
} from "@/lib/session";

const Packing = async () => {
	const project = await requireSelectedMemberProject();
	const userId = await requireFreshPpicStatusAccess("SEDANG_DIPACKING");
	const allowedStatuses = (await getPpicAccess(userId))?.allowed_status ?? [];
	return <MemberScannerPage project={project} allowedStatuses={allowedStatuses} />;
};

export default Packing;
