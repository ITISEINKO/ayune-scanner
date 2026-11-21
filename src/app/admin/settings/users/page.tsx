import { SettingPage } from "@/features/settings";
import { ppicSession } from "@/lib/session";
import { getPpicAccess } from "@/lib/db";

export default async function Settings() {
	const session = await ppicSession();
	const canManageAdmin = session?.role === "ADMIN" &&
		(await getPpicAccess(session.user_id))?.role === "ADMIN";
	return <SettingPage canManageAdmin={canManageAdmin} />;
}
