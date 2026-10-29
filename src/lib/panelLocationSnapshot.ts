import { readFile } from "node:fs/promises";
import path from "node:path";
import catalog from "@/data/panel-locations/catalog.json";
import { withPanelLocationDetails } from "@/lib/panelLocation";
import { getStoredPanelLocation, getStoredPanelLocationByBarcode } from "@/lib/panelLocationStore";
import type { PanelLocationSnapshot, PanelLocationView } from "@/types/panelLocation";

// Bundled files are immutable deployment assets; keep at most one parsed snapshot per catalog entry.
const bundledSnapshots = new Map<string, Promise<PanelLocationSnapshot>>();
const readBundledSnapshot = (project: string) => {
	const cached = bundledSnapshots.get(project);
	if (cached) return cached;
	const entry = catalog[project as keyof typeof catalog];
	const loaded = Promise.all([
		readFile(path.join(process.cwd(), "src/data/panel-locations", entry.snapshot), "utf8"),
		readFile(path.join(process.cwd(), "src/data/panel-locations", entry.mapping ?? path.join(path.dirname(entry.snapshot), "mapping.json")), "utf8"),
	]).then(([snapshot, mapping]) => withPanelLocationDetails(JSON.parse(snapshot), JSON.parse(mapping)))
		.catch((cause: unknown) => { bundledSnapshots.delete(project); throw cause; });
	bundledSnapshots.set(project, loaded);
	return loaded;
};

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
		for (const key of Object.keys(catalog)) {
			if (bundled && key !== project) continue;
			const snapshot = await readBundledSnapshot(key);
			if (!bundled && !snapshot.panels.some((panel) => panel.barcode === barcode)) continue;
			if (!bundled && (key === stored?.metadata.projectKey || await getStoredPanelLocation(key))) continue;
			matches.push({ project: key, snapshot });
		}
		if (matches.length + Number(Boolean(stored)) > 1) throw new Error("LOCATION_AMBIGUOUS");
		if (matches[0]) { project = matches[0].project; bundledSnapshot = matches[0].snapshot; }
	}
	if (!stored && (revision || !Object.hasOwn(catalog, project))) return null;
	const entry = catalog[project as keyof typeof catalog];
	const snapshot = stored?.snapshot ?? bundledSnapshot ?? await readBundledSnapshot(project);
	if (bundled && !barcode) barcode = snapshot.panels[0]?.barcode ?? "";
	const selected = snapshot.panels.find((panel) => panel.barcode === barcode);
	return {
		projectId: project,
		projectName: stored?.metadata.name ?? entry.name,
		version: snapshot.version,
		versionNumber: stored?.metadata.versionNumber ?? 1,
		barcode,
		panels: selected ? snapshot.panels.filter((panel) => panel.roomName === selected.roomName) : [],
	};
};
