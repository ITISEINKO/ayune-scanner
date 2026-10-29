import { readFile } from "node:fs/promises";
import path from "node:path";
import catalog from "@/data/panel-locations/catalog.json";
import { withPanelLocationDetails } from "@/lib/panelLocation";
import { getStoredPanelLocation, getStoredPanelLocationByBarcode } from "@/lib/panelLocationStore";
import type { PanelLocationSnapshot, PanelLocationView } from "@/types/panelLocation";

export const getPanelLocation = async (
	project: string,
	barcode: string,
	revision?: string,
	bundled = false,
): Promise<PanelLocationView | null> => {
	const stored = await (bundled ? Promise.resolve(null) : revision ? getStoredPanelLocation(project, revision) : getStoredPanelLocationByBarcode(barcode)).catch((cause: unknown) => {
		if (revision && cause instanceof Error && cause.message === "REVISION_NOT_FOUND") return null;
		throw cause;
	});
	if (stored) project = stored.metadata.projectKey;
	let bundledSnapshot: PanelLocationSnapshot | undefined;
	// Bundled models are fixed deployment assets; online models use the indexed serial lookup above.
	if (!revision) {
		const matches: { project: string; snapshot: PanelLocationSnapshot }[] = [];
		for (const [key, entry] of Object.entries(catalog)) {
			if (bundled ? key !== project : await getStoredPanelLocation(key)) continue;
			const snapshot = JSON.parse(await readFile(path.join(process.cwd(), "src/data/panel-locations", entry.snapshot), "utf8")) as PanelLocationSnapshot;
			if (bundled || snapshot.panels.some((panel) => panel.barcode === barcode)) matches.push({ project: key, snapshot });
		}
		if (matches.length + Number(Boolean(stored)) > 1) throw new Error("LOCATION_AMBIGUOUS");
		if (matches[0]) { project = matches[0].project; bundledSnapshot = matches[0].snapshot; }
	}
	if (!stored && (revision || !Object.hasOwn(catalog, project))) return null;
	const entry = catalog[project as keyof typeof catalog];
	const snapshot = stored?.snapshot ?? bundledSnapshot ?? JSON.parse(await readFile(path.join(process.cwd(), "src/data/panel-locations", entry.snapshot), "utf8")) as PanelLocationSnapshot;
	const namedSnapshot = stored ? snapshot : withPanelLocationDetails(snapshot, JSON.parse(await readFile(
		path.join(process.cwd(), "src/data/panel-locations", entry.mapping ?? path.join(path.dirname(entry.snapshot), "mapping.json")), "utf8")));
	if (bundled && !barcode) barcode = snapshot.panels[0]?.barcode ?? "";
	const selected = snapshot.panels.find((panel) => panel.barcode === barcode);
	return {
		projectId: project,
		projectName: stored?.metadata.name ?? entry.name,
		version: snapshot.version,
		versionNumber: stored?.metadata.versionNumber ?? 1,
		barcode,
		panels: selected ? namedSnapshot.panels.filter((panel) => panel.roomName === selected.roomName) : [],
	};
};
