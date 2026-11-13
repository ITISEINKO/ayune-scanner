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

const CariLokasi = async ({ searchParams }: { searchParams: Promise<{ barcode?: string; model?: string; source?: string }> }) => {
	await requireClickUpToken();
	const session = await ppicSession();
	if (!session) redirect("/login");
	const [access, importer] = await Promise.all([
		getPpicAccess(session.user_id), canImportLby(session.user_id),
	]);
	if (!importer && !hasPpicAdminAccess(access?.role) && !(access?.role === "MEMBER" && Number(access.active) === 1))
		redirect("/unauthorized");
	const { barcode = "", model, source } = await searchParams;
	if (typeof barcode !== "string" || barcode.length > 100) notFound();
	if (source !== undefined && source !== "old") notFound();
	const serialNumber = barcode.trim();
	let location: PanelLocationView | null = null;
	let errorMessage = "";
	let trialMatches: TrialPanelMatch[] = [];
	let models: Awaited<ReturnType<typeof listTrialModels>> = [];
	let selectedModel: { id: string; name: string; revision: string; rooms: { id: string; name: string }[] } | null = null;
	if (!serialNumber) {
		models = (await listTrialModels()).filter((item) => item.activeRevision);
		if (model) {
			const selected = models.find((item) => item.id === model);
			if (!selected?.activeRevision) notFound();
			const snapshot = await readTrialModel(selected.id, selected.activeRevision);
			if (!snapshot) notFound();
			selectedModel = { id: selected.id, name: selected.name, revision: selected.activeRevision, rooms: snapshot.rooms.map(({ id, name }) => ({ id, name })) };
		}
	}
	if (serialNumber) {
		if (source !== "old") try {
			const [matches, models] = await Promise.all([searchTrialPanels(serialNumber, true), listTrialModels()]);
			const resolved = await Promise.all(matches.map(async (match) => {
				const revision = models.find((model) => model.id === match.modelId && model.activeRevision === match.revision)?.activeRevision;
				const snapshot = revision ? await readTrialModel(match.modelId, revision) : null;
				const room = snapshot?.rooms.find((item) => item.id === match.roomId && item.matches.some((panel) => panel.id === match.panelId && panel.serial === serialNumber));
				if (!revision || !room) throw new Error("ACTIVE_MODEL_CHANGED_OR_INVALID");
				return { ...match, revision, roomName: room.name };
			}));
			trialMatches = resolved;
		} catch (error) {
			console.error("Pencarian model trial gagal:", error);
			errorMessage = "Model aktif belum dapat diperiksa. Coba lagi sebentar.";
		}
		if (source !== "old" && !trialMatches.length && !errorMessage) errorMessage = "Serial tidak ditemukan pada model 3D aktif.";
		if (source === "old") {
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
	return <SearchPanelLocationPage key={serialNumber || model || "search"} serialNumber={serialNumber} location={location} errorMessage={errorMessage} trialMatches={trialMatches} models={models} selectedModel={selectedModel} oldSource={source === "old"} />;
};

export default CariLokasi;
