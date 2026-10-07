import { SettingPage } from "@/features/settings";
import { requireSuperAdmin } from "@/lib/session";

const Settings = async () => {
	await requireSuperAdmin();
	return <SettingPage />;
};

export default Settings;
