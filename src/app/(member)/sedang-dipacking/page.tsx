import { PackingPage } from "@/features/member/PackingPage";
import { requirePpicStatusAccess, requireSelectedMemberProject } from "@/lib/session";

const Packing = async () => {
	const project = await requireSelectedMemberProject();
	await requirePpicStatusAccess("SEDANG_DIPACKING");
	return <PackingPage project={project} />;
};

export default Packing;
