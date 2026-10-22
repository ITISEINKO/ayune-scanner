import type { PpicStatus } from "@/types/ppic";

// color controls charts, bars, dots and badge tint; textColor controls badge text.
export const STATUS_COLOR_CONFIG = {
	UNSCANNED: {
		label: "Belum scan",
		shortLabel: "Belum scan",
		color: "#94a3b8",
		textColor: "#475569",
	},
	BARANG_DITERIMA: {
		label: "Barang Diterima",
		shortLabel: "Diterima",
		color: "#a78bfa",
		textColor: "#6d28d9",
	},
	SEDANG_DIPACKING: {
		label: "Sedang Dipacking",
		shortLabel: "Dipacking",
		color: "#60a5fa",
		textColor: "#1d4ed8",
	},
	TERPASANG_DIGUNAKAN: {
		label: "Terpasang / Digunakan",
		shortLabel: "Terpasang",
		color: "#6eb59a",
		textColor: "#047857",
	},
	DALAM_PROSES_RETUR: {
		label: "Dalam Proses Retur",
		shortLabel: "Retur",
		color: "#e18b8b",
		textColor: "#b91c1c",
	},
	OTHER: { label: "Status lainnya", shortLabel: "Lainnya", color: "#a8a29e", textColor: "#57534e" },
} satisfies Record<
	PpicStatus | "UNSCANNED" | "OTHER",
	{ label: string; shortLabel: string; color: string; textColor: string }
>;

export const STATUS_BADGE_CLASS_NAME =
	"border-transparent [background-color:color-mix(in_srgb,var(--status-color)_18%,transparent)] text-(--status-text-color) dark:[background-color:color-mix(in_srgb,var(--status-color)_22%,transparent)] dark:text-[color-mix(in_srgb,var(--status-text-color)_45%,white)]";
