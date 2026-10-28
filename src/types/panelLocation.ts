export type PanelLocation = {
	id?: string;
	barcode: string | null;
	roomName: string;
	panelNumber: string;
	corners: number[][];
};

export type PanelLocationSnapshot = {
	version: string;
	panels: PanelLocation[];
};
