export type PanelLocation = {
	barcode: string;
	roomName: string;
	panelNumber: string;
	corners: number[][];
};

export type PanelLocationSnapshot = {
	version: string;
	panels: PanelLocation[];
};

export type PanelLocationView = PanelLocationSnapshot & {
	projectId: string;
	projectName: string;
	barcode: string;
};

export type ManualPanelItem = {
	task_id: string | null;
	nama: string;
	serial_number: string;
	status: string | null;
	location: PanelLocationView | null;
	location_error?: string;
};

export type LbyImportManifest = {
	projectKey: string;
	name: string;
	orderId: string;
	revision: string;
	version: string;
	importedAt: string;
	panelCount: number;
	sourceModelSha256: string;
	mappingSha256: string;
};

export type LbyImportVersion = LbyImportManifest & {
	roomCount: number;
	sampleBarcode: string;
};

export type LbyImportState = {
	projectKey: string;
	activeRevision: string | null;
	bundledVersion: string | null;
	versions: LbyImportVersion[];
};
