import type { PanelLocation, PanelLocationSnapshot } from "../types/panelLocation.ts";

const PANEL_NAMES: Record<string, string> = {
	"顶板": "Panel atas", "底板": "Panel bawah",
	"左侧板": "Panel samping kiri", "右侧板": "Panel samping kanan",
	"插槽背板": "Panel belakang beralur", "固定层板": "Rak tetap",
	"右开门板(全盖)": "Pintu bukaan kanan (full overlay)",
	"左开门板(全盖)": "Pintu bukaan kiri (full overlay)",
	"抽面": "Panel depan laci", "切角竖板": "Panel tegak bersudut",
};

// Keep vendor names intact for geometry/door detection; unknown Chinese labels use the panel number.
export const panelDisplayName = (name: string | undefined, fallback = "Panel") =>
	name && PANEL_NAMES[name.trim()] || (name && !/\p{Script=Han}/u.test(name) ? name : fallback);

export const withPanelLocationDetails = (snapshot: PanelLocationSnapshot, mapping: { panels: Pick<PanelLocation, "barcode" | "panelName" | "doorOpenType">[] }): PanelLocationSnapshot => {
	const details = new Map(mapping.panels.map((panel) => [panel.barcode, panel]));
	return { ...snapshot, panels: snapshot.panels.map((panel) => {
		const detail = details.get(panel.barcode);
		const panelName = typeof detail?.panelName === "string" ? detail.panelName : undefined;
		const opening = panel.doorOpenType ?? detail?.doorOpenType;
		// Older immutable imports retain explicit left/right names but not the opening field.
		const doorOpenType = opening === "left" || opening === "right" || opening === "up" || opening === "bottom"
			? opening : /^左开门板|^左開門板/.test(panelName ?? "") ? "left" : /^右开门板|^右開門板/.test(panelName ?? "") ? "right" : undefined;
		return { ...panel, panelName, doorOpenType };
	}) };
};

// Match explicit panel names, never room names (a room named ENTRANCE DOOR also contains structural panels).
export const isDoorPanel = (panel: PanelLocation) =>
	Boolean(panel.doorOpenType) || (typeof panel.panelName === "string" && /门板|門板|\bdoor\b|\bpintu\b/i.test(panel.panelName));

const panelDoorMotion = (panel: PanelLocation) => {
	const opening = panel.doorOpenType;
	if (!opening) return null;
	const vertical = opening === "left" || opening === "right";
	const edge = panel.corners[vertical ? 4 : 1].map((value, axis) => value - panel.corners[0][axis]);
	const length = Math.hypot(...edge);
	if (length === 0) return null;
	return { pivot: panel.corners[opening === "right" ? 1 : opening === "up" ? 4 : 0],
		axis: edge.map((value) => value / length), angle: (opening === "left" || opening === "up" ? -1 : 1) * Math.PI / 2 };
};

export const panelDoorCorners = (panel: PanelLocation, progress: number, points = panel.corners) => {
	const motion = panelDoorMotion(panel);
	if (!motion || progress === 0) return points;
	const { pivot, axis, angle } = motion;
	const cos = Math.cos(angle * progress), sin = Math.sin(angle * progress);
	return points.map((point) => {
		const [x, y, z] = point.map((value, index) => value - pivot[index]);
		const dot = axis[0] * x + axis[1] * y + axis[2] * z;
		const cross = [axis[1] * z - axis[2] * y, axis[2] * x - axis[0] * z, axis[0] * y - axis[1] * x];
		return [x, y, z].map((value, index) => pivot[index] + value * cos + cross[index] * sin + axis[index] * dot * (1 - cos));
	});
};

export const panelLocationUrl = (project: string, barcode: string) =>
	`/panel-location?${new URLSearchParams({ project, barcode })}`;

const BOX_FACES = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
const BOX_EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

export const projectPanelLocations = (panels: PanelLocation[], yaw: number, pitch: number, barcode: string, doorProgress = 0) => {
	const points = panels.flatMap((panel) => panel.geometry?.vertices ?? panel.corners);
	const center = [0, 1, 2].map((axis) =>
		(Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2);
	const spread = Math.hypot(...[0, 1, 2].map((axis) =>
		Math.max(...points.map((point) => point[axis])) - Math.min(...points.map((point) => point[axis])))) * 0.25;
	const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw), cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
	const rotate = ([x, y, z]: number[]) => {
		const horizontal = x * cosYaw + y * sinYaw;
		const depth = -x * sinYaw + y * cosYaw;
		return [horizontal, depth * sinPitch - z * cosPitch, depth * cosPitch + z * sinPitch];
	};
	return panels.map((panel) => {
		const vertices = panel.geometry?.vertices ?? panel.corners;
		const offset = [0, 0, 0];
		if (panel.barcode === barcode && panels.length > 1) {
			// shortcut: the shortest box edge approximates the panel normal; use assembly axes for joinery-accurate extraction.
			const normal = [1, 3, 4].map((corner) => panel.corners[corner].map((value, axis) => value - panel.corners[0][axis]))
				.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))[0];
			const length = Math.hypot(...normal);
			const outward = normal.reduce((sum, value, axis) => sum + value *
				(panel.corners.reduce((total, point) => total + point[axis], 0) / panel.corners.length - center[axis]), 0) < 0 ? -1 : 1;
			if (length > 0) normal.forEach((value, axis) => { offset[axis] = value / length * spread * outward; });
		}
		const project = (point: number[]) => rotate(point.map((value, axis) => value - center[axis]));
		const motion = panelDoorMotion(panel);
		// Fit the full hinge circle so opening a door never reframes or clips its swing.
		const fitPoints = motion ? vertices.flatMap((point) => {
			const relative = point.map((value, axis) => value - motion.pivot[axis]);
			const dot = relative.reduce((sum, value, axis) => sum + value * motion.axis[axis], 0);
			const circleCenter = project(motion.pivot.map((value, axis) => value + motion.axis[axis] * dot));
			const radius = Math.hypot(...relative.map((value, axis) => value - motion.axis[axis] * dot));
			const projectedAxis = rotate(motion.axis);
			const extent = projectedAxis.map((value) => radius * Math.sqrt(Math.max(0, 1 - value * value)));
			return [-1, 1].map((sign) => circleCenter.map((value, axis) => value + sign * extent[axis]));
		}) : vertices.map(project);
		return {
			...panel,
			explodeOffset: rotate(offset),
			fitPoints,
			points: panelDoorCorners(panel, doorProgress, vertices).map(project),
			faceIndices: panel.geometry?.faces ?? BOX_FACES,
			edgeIndices: panel.geometry?.edges ?? BOX_EDGES,
		};
	});
};
