"use server";

import { canImportLby } from "@/lib/db";
import { getPanelLocation } from "@/lib/panelLocationSnapshot";
import { clickUpToken, ppicSession } from "@/lib/session";

export async function loadLbyPreview(project: string, barcode: string, revision: string | null) {
	const session = await ppicSession();
	if (!session || !(await clickUpToken()) || !(await canImportLby(session.user_id)))
		throw new Error("Akses preview tidak tersedia. Silakan login kembali.");
	if (typeof project !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(project) ||
		typeof barcode !== "string" || barcode.length > 100 ||
		(revision !== null && (typeof revision !== "string" || !/^[a-f0-9]{64}$/.test(revision))))
		throw new Error("Model preview tidak valid.");
	const location = await getPanelLocation(project, barcode, revision ?? undefined, revision === null);
	if (!location?.panels.length) throw new Error("Model preview tidak tersedia.");
	return location;
}
