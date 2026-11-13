import { SearchPanelLocationPage } from "@/features/member/SearchPanelLocationPage";
import { notFound, redirect } from "next/navigation";
import { canImportLby, getPpicAccess } from "@/lib/db";
import { getPanelLocation } from "@/lib/panelLocationSnapshot";
import { ppicSession, requireClickUpToken } from "@/lib/session";
import { hasPpicAdminAccess } from "@/types/ppic";
import { listTrialModels, readTrialModel, searchTrialPanels } from "@/lib/trialPublicModels";
import type { PanelLocationView } from "@/types/panelLocation";
import type { TrialPanelMatch } from "@/types/publicModel";

export const metadata = { title: "Cari lokasi panel | Production Scanner" };

const CariLokasi = async ({ searchParams }: { searchParams: Promise<{ barcode?: string }> }) => {
	await requireClickUpToken();
	const session = await ppicSession();
	if (!session) redirect("/login");
	const [access, importer] = await Promise.all([
		getPpicAccess(session.user_id), canImportLby(session.user_id),
	]);
	if (!importer && !hasPpicAdminAccess(access?.role) && !(access?.role === "MEMBER" && Number(access.active) === 1))
		redirect("/unauthorized");
	const { barcode = "" } = await searchParams;
	if (typeof barcode !== "string" || barcode.length > 100) notFound();
	const serialNumber = barcode.trim();
	let location: PanelLocationView | null = null;
	let errorMessage = "";
	let trialMatches: TrialPanelMatch[] = [];
	if (serialNumber) {
		try {
			const [matches, models] = await Promise.all([searchTrialPanels(serialNumber, true), listTrialModels()]);
			const resolved = await Promise.all(matches.map(async (match) => {
				const revision = models.find((model) => model.id === match.modelId && model.activeRevision === match.revision)?.activeRevision;
				const snapshot = revision ? await readTrialModel(match.modelId, revision) : null;
				const room = snapshot?.rooms.find((item) => item.id === match.roomId && item.matches.some((panel) => panel.id === match.panelId && panel.serial === serialNumber));
				return revision && room ? { ...match, revision, roomName: room.name } : null;
			}));
			trialMatches = resolved.filter((item): item is NonNullable<typeof item> => item !== null);
		} catch (error) {
			console.error("Pencarian model trial gagal:", error);
		}
		if (!trialMatches.length) {
			try {
				location = await getPanelLocation("", serialNumber);
				if (!location) errorMessage = "Lokasi panel untuk serial ini belum tersedia. Periksa serial atau hubungi drafter untuk mengunggah model LBY.";
			} catch (cause) {
				errorMessage = cause instanceof Error && cause.message === "LOCATION_AMBIGUOUS"
					? "Serial ditemukan di beberapa model aktif. Hubungi admin untuk memeriksa model LBY."
					: "Lokasi panel belum dapat dimuat. Coba lagi sebentar.";
			}
		}
	}
	return <SearchPanelLocationPage key={serialNumber} serialNumber={serialNumber} location={location} errorMessage={errorMessage} trialMatches={trialMatches} />;
};

export default CariLokasi;
