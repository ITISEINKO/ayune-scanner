import type { PanelLocation } from "../types/panelLocation.ts";

export const panelLocationUrl = (project: string, barcode: string) =>
	`/panel-location?${new URLSearchParams({ project, barcode })}`;

export const projectPanelLocations = (panels: PanelLocation[], yaw: number, pitch: number) => {
	const points = panels.flatMap((panel) => panel.corners);
	const center = [0, 1, 2].map((axis) =>
		(Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2);
	return panels.map((panel) => ({
		...panel,
		points: panel.corners.map((point) => {
			const [x, y, z] = point.map((n, axis) => n - center[axis]);
			const horizontal = x * Math.cos(yaw) + y * Math.sin(yaw);
			const depth = -x * Math.sin(yaw) + y * Math.cos(yaw);
			return [horizontal, depth * Math.sin(pitch) - z * Math.cos(pitch),
				depth * Math.cos(pitch) + z * Math.sin(pitch)];
		}),
	}));
};
