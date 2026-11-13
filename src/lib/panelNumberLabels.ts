// shortcut: pairwise collision checks suit room-sized models; use a spatial index for much larger rooms.
export function layoutPanelNumbers(items: { barcode: string; number: string; x: number; y: number }[], scale: number, bounds: { left: number; top: number; right: number; bottom: number }) {
	const placed: (typeof items[number] & { width: number; height: number })[] = [];
	for (const item of items) {
		const width = Math.max(24, item.number.length * 9 + 12) * scale, height = 22 * scale;
		if (item.x - width / 2 < bounds.left || item.x + width / 2 > bounds.right || item.y - height / 2 < bounds.top || item.y + height / 2 > bounds.bottom) continue;
		if (items.some((other) => other !== item && Math.hypot(item.x - other.x, item.y - other.y) < 2 * scale)) continue;
		if (placed.some((other) => Math.abs(item.x - other.x) < (width + other.width) / 2 + 3 * scale && Math.abs(item.y - other.y) < (height + other.height) / 2 + 3 * scale)) continue;
		placed.push({ ...item, width, height });
	}
	return placed;
}
