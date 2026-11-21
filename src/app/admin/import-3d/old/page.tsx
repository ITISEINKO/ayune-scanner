import { LbyImportPage } from "@/features/panel-location/LbyImportPage";
import { canImportLby } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function OldAdminModels() {
	const session = await getAppSession();
	if (!session) redirect("/login");
	if (!(await canImportLby(session.user_id))) redirect("/unauthorized");
	return <LbyImportPage workspace="Admin" />;
}
