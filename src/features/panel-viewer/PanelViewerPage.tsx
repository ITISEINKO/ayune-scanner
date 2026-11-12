"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scanner } from "@/components/scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PanelViewerSearch() {
	const router = useRouter();
	const [code, setCode] = useState("");
	const find = (value: string) => {
		const trimmed = value.trim();
		if (trimmed && trimmed.length <= 100) router.push(`/panel-viewer?${new URLSearchParams({ q: trimmed })}`);
	};
	return <div className="mt-5 grid gap-4">
		<Scanner onDetected={find} />
		<form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); find(code); }}>
			<Input aria-label="Serial atau nomor panel" placeholder="Serial atau nomor panel" maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} />
			<Button type="submit">Cari</Button>
		</form>
	</div>;
}
