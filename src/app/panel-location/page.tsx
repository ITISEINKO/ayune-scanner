import { hasPpicAdminAccess } from "@/types/ppic";
import { notFound, redirect } from "next/navigation";
import { PanelLocationViewer } from "@/features/panel-location/PanelLocationViewer";
import { getPpicAccess } from "@/lib/db";
import { getPanelLocation } from "@/lib/panelLocationSnapshot";
import { ppicSession, requireClickUpToken } from "@/lib/session";

export const metadata = { title: "Posisi panel | Production Scanner" };

export default async function PanelLocationPage({
	searchParams,
}: {
	searchParams: Promise<{ project?: string; barcode?: string }>;
}) {
	await requireClickUpToken();
	const session = await ppicSession();
	if (!session) redirect("/login");
	const access = await getPpicAccess(session.user_id);
	if (
		!hasPpicAdminAccess(access?.role) &&
		!(access?.role === "MEMBER" && Number(access.active) === 1)
	)
		redirect("/unauthorized");
	const { project, barcode = "" } = await searchParams;
	// Only imported projects can be read; query strings never become file paths or vendor requests.
	if (
		typeof project !== "string" ||
		typeof barcode !== "string" ||
		barcode.length > 100
	)
		notFound();
	const serial = barcode.trim();
	const location = await getPanelLocation(project, serial);
	if (!location) notFound();
	return (
		<main className="mx-auto min-h-dvh max-w-6xl p-4 sm:p-6">
			<PanelLocationViewer key={`${project}:${serial}`} {...location} />
		</main>
	);
}
