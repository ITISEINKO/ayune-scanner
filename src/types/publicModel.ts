export type PublicRoomGeometry = {
	id?: string;
	position: number[];
	index: number[];
	uv?: number[];
	texture?: string | null;
	color?: number | null;
	number: string;
	doorOpenType: "left" | "right" | "up" | "bottom" | null;
	doorMotion?: { pivot: number[]; axis: number[] } | null;
	isDoor: boolean;
	hinges: { position: number[]; index: number[]; matrix: number[] }[];
	hingeCount?: number;
	drawerOffset?: number[];
	drawerRails?: { position: number[]; index: number[]; matrix: number[] }[];
}[];
export type TrialPublicModel = {
	id: string;
	name: string;
	activeRevision: string | null;
	versions: { revision: string; number: number; importedAt: string; panelCount?: number; groupCount?: number }[];
};
export type TrialPanelMatch = {
	modelId: string;
	name: string;
	roomId: string;
	roomName: string;
	panelId: string;
	number: string;
	revision: string;
};

export type PanelHpl = {
	serial: string;
	side1: string | null;
	side2: string | null;
	status: "matched" | "partial" | "missing_hpl" | "panel_not_found" | "ambiguous" | "conflict" | "missing_parent" | "missing_production_serial";
	source: string | null;
};
