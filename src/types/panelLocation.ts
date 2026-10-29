export type PanelLocation = {
	barcode: string;
	roomName: string;
	panelNumber: string;
	panelName?: string;
	doorOpenType?: "left" | "right" | "up" | "bottom";
	corners: number[][];
	geometry?: { vertices: number[][]; faces: number[][]; edges: number[][] };
};

export type PanelLocationSnapshot = {
	version: string;
	panels: PanelLocation[];
};

export type PanelLocationView = PanelLocationSnapshot & {
	versionNumber: number;
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
	versionNumber: number;
	roomCount: number;
	sampleBarcode: string;
};

export type LbyImportState = {
	projectKey: string;
	sourceUrl?: string;
	activeRevision: string | null;
	bundledVersion: string | null;
	versions: LbyImportVersion[];
};

export type LbyImportStage = "downloading" | "panels" | "rooms" | "saving";

export type LbyImportResponse = {
	ok?: boolean;
	error?: string;
	stage?: LbyImportStage;
	state?: LbyImportState;
	states?: LbyImportState[];
};
