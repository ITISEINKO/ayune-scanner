import { redirect } from "next/navigation";
import { Import3DPage } from "@/features/import/Import3DPage";
import { canImportLby } from "@/lib/db";
import { getAppSession } from "@/lib/session";

export const metadata = { title: "Import 3D | Production Scanner" };

export default async function AdminImport3D() {
	const session = await getAppSession();
	if (!session) redirect("/login");
	if (!(await canImportLby(session.user_id))) redirect("/unauthorized");
	return <Import3DPage workspace="Admin" />;
}
