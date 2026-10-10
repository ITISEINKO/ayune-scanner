import { BarangDiterimaPage } from "@/features/member/BarangDiterimaPage";
import { requirePpicStatusAccess, requireSelectedMemberProject } from "@/lib/session";

const BarangDIterima = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("BARANG_DITERIMA");
	return <BarangDiterimaPage project={project} />;
};

export default BarangDIterima;
