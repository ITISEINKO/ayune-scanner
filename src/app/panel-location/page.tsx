import { notFound, redirect } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import catalog from "@/data/panel-locations/catalog.json";
import { PanelLocationViewer } from "@/features/panel-location/PanelLocationViewer";
import { getPpicAccess } from "@/lib/db";
import { ppicSession, requireClickUpToken } from "@/lib/session";
import type { PanelLocationSnapshot } from "@/types/panelLocation";

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
		access?.role !== "SUPER_ADMIN" &&
		!(access?.role === "MEMBER" && Number(access.active) === 1)
	)
		redirect("/unauthorized");
	const { project, barcode = "" } = await searchParams;
	// Only imported projects can be read; query strings never become file paths or vendor requests.
	if (
		typeof project !== "string" || !Object.hasOwn(catalog, project) ||
		typeof barcode !== "string" ||
		barcode.length > 100
	)
		notFound();
	const entry = catalog[project as keyof typeof catalog];
	const snapshot = JSON.parse(await readFile(path.join(process.cwd(), "src/data/panel-locations", entry.snapshot), "utf8")) as PanelLocationSnapshot;
	const serial = barcode.trim();
	const selected = snapshot.panels.find((panel) => panel.barcode === serial);
	return (
		<PanelLocationViewer
			key={`${project}:${serial}`}
			projectId={project}
			projectName={entry.name}
			version={snapshot.version}
			barcode={serial}
			panels={
				selected
					? snapshot.panels.filter(
							(panel) => panel.roomName === selected.roomName,
						)
					: []
			}
		/>
	);
}
