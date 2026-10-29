import { redirect } from "next/navigation";
import { LbyImportPage } from "@/features/panel-location/LbyImportPage";
import { canImportLby } from "@/lib/db";
import { ppicSession } from "@/lib/session";

export const metadata = { title: "Import 3D | Production Scanner" };

export default async function AdminImport3D() {
	const session = await ppicSession();
	if (!session) redirect("/login");
	if (!(await canImportLby(session.user_id))) redirect("/unauthorized");
	return <LbyImportPage workspace="Admin" />;
}
