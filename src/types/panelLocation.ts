export type PanelLocation = {
	barcode: string;
	roomName: string;
	panelNumber: string;
	panelNumberVerified?: boolean;
	panelName?: string;
	doorOpenType?: "left" | "right" | "up" | "bottom";
	corners: number[][];
	geometry?: { vertices: number[][]; faces: number[][]; edges: number[][] };
	hinges?: {
		id: string;
		name: string;
		code?: string;
		position: number[];
		panelPosition: number[];
		geometry: NonNullable<PanelLocation["geometry"]>;
	}[];
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
	project_name?: string | null;
	project_id?: string | null;
};

export type ManualPanelChoice = Pick<ManualPanelItem, "task_id" | "nama" | "status" | "project_name" | "project_id">;

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
	candidate?: LbyImportVersion;
	ok?: boolean;
	error?: string;
	stage?: LbyImportStage;
	state?: LbyImportState;
	states?: LbyImportState[];
};
