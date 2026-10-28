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
	task_id: string;
	nama: string;
	serial_number: string;
	status: string;
	location: PanelLocationView | null;
	location_error?: string;
};
