import type { PanelLocation } from "../types/panelLocation.ts";

export const panelLocationUrl = (project: string, barcode: string) =>
	`/panel-location?${new URLSearchParams({ project, barcode })}`;

export const projectPanelLocations = (panels: PanelLocation[], yaw: number, pitch: number) => {
	const points = panels.flatMap((panel) => panel.corners);
	const center = [0, 1, 2].map((axis) =>
		(Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2);
	const spread = Math.hypot(...[0, 1, 2].map((axis) =>
		Math.max(...points.map((point) => point[axis])) - Math.min(...points.map((point) => point[axis])))) * 0.1;
	const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw), cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
	const rotate = ([x, y, z]: number[]) => {
		const horizontal = x * cosYaw + y * sinYaw;
		const depth = -x * sinYaw + y * cosYaw;
		return [horizontal, depth * sinPitch - z * cosPitch, depth * cosPitch + z * sinPitch];
	};
	return panels.map((panel) => {
		const direction = center.map((value, axis) =>
			panel.corners.reduce((sum, point) => sum + point[axis], 0) / panel.corners.length - value);
		const distance = Math.hypot(...direction);
		// shortcut: radial separation is a visual aid; use assembly axes for joinery-accurate explode directions.
		return {
			...panel,
			explodeOffset: rotate(direction.map((value) => distance ? value / distance * spread : 0)),
			points: panel.corners.map((point) => rotate(point.map((value, axis) => value - center[axis]))),
		};
	});
};
