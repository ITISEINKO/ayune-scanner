import { readFile } from "node:fs/promises";
import path from "node:path";
import catalog from "@/data/panel-locations/catalog.json";
import type { PanelLocationSnapshot, PanelLocationView } from "@/types/panelLocation";

export const getPanelLocation = async (
	project: string,
	barcode: string,
): Promise<PanelLocationView | null> => {
	if (!Object.hasOwn(catalog, project)) return null;
	const entry = catalog[project as keyof typeof catalog];
	const snapshot = JSON.parse(await readFile(path.join(process.cwd(), "src/data/panel-locations", entry.snapshot), "utf8")) as PanelLocationSnapshot;
	const selected = snapshot.panels.find((panel) => panel.barcode === barcode);
	return {
		projectId: project,
		projectName: entry.name,
		version: snapshot.version,
		barcode,
		panels: selected ? snapshot.panels.filter((panel) => panel.roomName === selected.roomName) : [],
	};
};
