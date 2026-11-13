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
	versions: { revision: string; number: number; importedAt: string }[];
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
