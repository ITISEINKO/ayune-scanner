import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { getLastAdminDashboard } from "@/lib/adminDashboard";
import { isPpicSuperAdmin } from "@/lib/db";
import { clickUpToken, ppicSession, requireSuperAdmin } from "@/lib/session";
import { redirect } from "next/navigation";

export const maxDuration = 60;

export default async function AdminHome() {
	await requireSuperAdmin();
	const token = await clickUpToken();
	if (!token) redirect("/login");
	const userId = (await ppicSession())?.user_id;
	if (!userId) redirect("/login");
	if (!(await isPpicSuperAdmin(userId))) redirect("/unauthorized");
	const initialData = await getLastAdminDashboard(userId);
	return (
		<AdminDashboard key={userId} userId={userId} initialData={initialData ?? undefined} />
	);
}
