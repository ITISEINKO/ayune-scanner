import { PackingPage } from "@/features/panel/PackingPage";
import { requirePpicStatusAccess } from "@/lib/session";

const Packing = async () => {
	await requirePpicStatusAccess("SEDANG_DIPACKING");
	return <PackingPage />;
};

export default Packing;
