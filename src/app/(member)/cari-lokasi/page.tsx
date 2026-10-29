import { SearchPanelLocationPage } from "@/features/member/SearchPanelLocationPage";
import { notFound, redirect } from "next/navigation";
import { canImportLby, getPpicAccess } from "@/lib/db";
import { getPanelLocation } from "@/lib/panelLocationSnapshot";
import { ppicSession, requireClickUpToken } from "@/lib/session";
import { hasPpicAdminAccess } from "@/types/ppic";
import type { PanelLocationView } from "@/types/panelLocation";

export const metadata = { title: "Cari lokasi panel | Production Scanner" };

const CariLokasi = async ({ searchParams }: { searchParams: Promise<{ barcode?: string }> }) => {
	await requireClickUpToken();
	const session = await ppicSession();
	if (!session) redirect("/login");
	const access = await getPpicAccess(session.user_id);
	const importer = await canImportLby(session.user_id);
	if (!importer && !hasPpicAdminAccess(access?.role) && !(access?.role === "MEMBER" && Number(access.active) === 1))
		redirect("/unauthorized");
	const { barcode = "" } = await searchParams;
	if (typeof barcode !== "string" || barcode.length > 100) notFound();
	const serialNumber = barcode.trim();
	let location: PanelLocationView | null = null;
	let errorMessage = "";
	if (serialNumber) {
		try {
			location = await getPanelLocation("", serialNumber);
			if (!location) errorMessage = "Lokasi panel untuk serial ini belum tersedia. Periksa serial atau hubungi admin.";
		} catch (cause) {
			errorMessage = cause instanceof Error && cause.message === "LOCATION_AMBIGUOUS"
				? "Serial ditemukan di beberapa model aktif. Hubungi admin untuk memeriksa model LBY."
				: "Lokasi panel belum dapat dimuat. Coba lagi sebentar.";
		}
	}
	return <SearchPanelLocationPage key={serialNumber} serialNumber={serialNumber} location={location} errorMessage={errorMessage} />;
};

export default CariLokasi;
