import { UbahManualPage } from "@/features/panel/UbahManualPage";
import { requireSuperAdmin } from "@/lib/session";

const UbahManual = async () => {
	await requireSuperAdmin();
	return <UbahManualPage />;
};

export default UbahManual;
