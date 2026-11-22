import { MemberScannerPage } from "@/features/member/MemberScannerPage";
import {
	getAppSession,
	requirePpicStatusAccess,
	requireSelectedMemberProject,
} from "@/lib/session";

const BarangDIterima = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("BARANG_DITERIMA");
	const allowedStatuses = (await getAppSession())?.allowed_status ?? [];
	return <MemberScannerPage project={project} allowedStatuses={allowedStatuses} />;
};

export default BarangDIterima;
