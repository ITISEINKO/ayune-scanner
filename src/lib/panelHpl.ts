import { CF_PANEL } from "./produksiPanel.ts";
import type { ClickUpTask } from "../types/clickup.ts";
import type { PanelHpl } from "../types/publicModel.ts";

export function panelHpl(tasks: ClickUpTask[], serial: string): PanelHpl {
	const empty = { serial, side1: null, side2: null, source: null };
	if (!serial) return { ...empty, status: "missing_production_serial" };
	const field = (task: ClickUpTask, id: string) => {
		const value = task.custom_fields?.find((item) => item.id === id)?.value;
		return typeof value === "string" ? value.trim() || null : null;
	};
	const matches = tasks.filter((task) => field(task, CF_PANEL.SERIAL_NUMBER) === serial);
	if (!matches.length) return { ...empty, status: "panel_not_found" };
	if (matches.length !== 1) return { ...empty, status: "ambiguous" };
	const leaf = matches[0];
	if (tasks.some((task) => task.parent === leaf.id)) return { ...empty, status: "ambiguous" };
	const parent = tasks.find((task) => task.id === leaf.parent);
	if (!parent) return { ...empty, status: "missing_parent" };
	const side1 = field(parent, CF_PANEL.KODE_HPL_SISI_1);
	const side2 = field(parent, CF_PANEL.KODE_HPL_SISI_2);
	if ((field(leaf, CF_PANEL.KODE_HPL_SISI_1) && field(leaf, CF_PANEL.KODE_HPL_SISI_1) !== side1) || (field(leaf, CF_PANEL.KODE_HPL_SISI_2) && field(leaf, CF_PANEL.KODE_HPL_SISI_2) !== side2)) return { ...empty, status: "conflict" };
	return { serial, side1, side2, status: side1 && side2 ? "matched" : side1 || side2 ? "partial" : "missing_hpl", source: `https://app.clickup.com/t/${encodeURIComponent(parent.id)}` };
}
