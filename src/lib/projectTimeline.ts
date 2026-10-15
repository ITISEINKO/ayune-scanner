import type { PpicProjectScanHistory } from "@/types/ppic";

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export const asDate = (value: string | number | Date | null | undefined) => {
	if (value === null || value === undefined) return null;
	const date =
		typeof value === "string" && /^\d+$/.test(value)
			? new Date(Number(value))
			: typeof value === "string" && value.includes(" ")
				? new Date(`${value.replace(" ", "T")}Z`)
				: new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

const jakartaDay = (date: Date) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: JAKARTA_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
	return Date.UTC(value("year"), value("month") - 1, value("day"));
};

export const calendarDaysBetween = (
	start: string | number | Date | null | undefined,
	end: string | number | Date | null | undefined = new Date(),
) => {
	const startDate = asDate(start);
	const endDate = asDate(end);
	return startDate && endDate ? Math.max(0, (jakartaDay(endDate) - jakartaDay(startDate)) / 86_400_000) : null;
};

export const elapsedLabel = (
	start: string | number | Date | null | undefined,
	end: string | number | Date | null | undefined,
) => {
	const startDate = asDate(start);
	const endDate = asDate(end);
	if (!startDate || !endDate) return "Belum ada durasi";
	const hours = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 3_600_000));
	return hours < 24 ? `${hours} jam` : `${Math.floor(hours / 24)} hari${hours % 24 ? ` ${hours % 24} jam` : ""}`;
};

export const scanWindow = (history: PpicProjectScanHistory[]) => {
	const sorted = [...history].sort(
		(a, b) => (asDate(a.scannedAt)?.getTime() ?? 0) - (asDate(b.scannedAt)?.getTime() ?? 0),
	);
	return { first: sorted[0] ?? null, last: sorted.at(-1) ?? null };
};
