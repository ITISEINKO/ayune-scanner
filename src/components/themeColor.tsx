"use client";

import { useEffect } from "react";

export function ThemeColor({ color }: { color: string }) {
	useEffect(() => {
		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (!meta) return;
		const previous = meta.content;
		const sample = document.createElement("span");
		sample.style.backgroundColor = color;
		sample.hidden = true;
		document.body.append(sample);
		meta.content = getComputedStyle(sample).backgroundColor;
		sample.remove();
		return () => { meta.content = previous; };
	}, [color]);
	return null;
}
