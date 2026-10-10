import { TerpasangDigunakanPage } from "@/features/member/TerpasangDigunakanPage";
import { requirePpicStatusAccess, requireSelectedMemberProject } from "@/lib/session";

const TerpasangDigunakan = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("TERPASANG_DIGUNAKAN");
	return <TerpasangDigunakanPage project={project} />;
};

export default TerpasangDigunakan;
