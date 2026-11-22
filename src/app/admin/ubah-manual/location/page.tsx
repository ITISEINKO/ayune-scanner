import { notFound } from "next/navigation";
import { UbahManualPage } from "@/features/admin/UbahManualPage";
import { listTrialModels, readTrialModel, searchTrialPanels } from "@/lib/trialPublicModels";
import { requireSuperAdmin } from "@/lib/session";

export const metadata = {
	title: "Lokasi dan status panel | Production Scanner",
};

export default async function ManualPanelLocation({
	searchParams,
}: {
	searchParams: Promise<{ barcode?: string }>;
}) {
	await requireSuperAdmin();
	const { barcode } = await searchParams;
	if (typeof barcode !== "string" || !barcode.trim() || barcode.length > 100)
		notFound();
	const serial = barcode.trim();
	let models: (Awaited<ReturnType<typeof searchTrialPanels>>[number] & { rooms: { id: string; name: string }[] })[] = [];
	let modelError = false;
	try {
		const [matches, activeModels] = await Promise.all([searchTrialPanels(serial, true), listTrialModels()]);
		models = await Promise.all(matches.map(async (match) => {
			if (!activeModels.some((model) => model.id === match.modelId && model.activeRevision === match.revision)) throw new Error("ACTIVE_MODEL_CHANGED_OR_INVALID");
			const snapshot = await readTrialModel(match.modelId, match.revision);
			if (!snapshot?.rooms.some((room) => room.id === match.roomId && room.matches.some((panel) => panel.id === match.panelId && panel.serial === serial))) throw new Error("ACTIVE_MODEL_CHANGED_OR_INVALID");
			return { ...match, rooms: snapshot.rooms.map(({ id, name }) => ({ id, name })) };
		}));
	} catch {
		modelError = true;
	}
	return <UbahManualPage key={barcode} serialNumber={serial} initialModels={models} modelError={modelError} />;
}
