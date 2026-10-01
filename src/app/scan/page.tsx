"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ExternalLink, ScanBarcode } from "lucide-react";
import { Scanner } from "@/components/scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ScanPage() {
	const lastScan = useRef(0);
	const finding = useRef(false);
	const [code, setCode] = useState("");
	const [message, setMessage] = useState("");
	const [isFinding, setIsFinding] = useState(false);

	const focusInput = () => {
		requestAnimationFrame(() => document.getElementById("barcode")?.focus());
	};
	useEffect(() => focusInput(), []);

	const findTask = async (value: string) => {
		const barcode = value.trim();
		const now = Date.now();
		if (!barcode || finding.current || now - lastScan.current < 1_000) return;
		finding.current = true;
		lastScan.current = now;
		setCode("");
		setIsFinding(true);
		setMessage("Mencari task…");
		const tab = window.open("about:blank", "_blank");

		try {
			const response = await fetch(`/api/find-task?code=${encodeURIComponent(barcode)}`);
			const result = (await response.json()) as { url?: string; count?: number; error?: string };
			if (!response.ok || !result.url) {
				tab?.close();
				setMessage(result.error === "NOT_FOUND" ? "Barcode tidak terdaftar." : "Task tidak dapat dicari. Coba lagi.");
				return;
			}
			if (!tab) {
				setMessage("Pop-up diblokir. Izinkan pop-up lalu scan lagi.");
				return;
			}
			tab.location.href = result.url;
			setMessage(result.count && result.count > 1 ? "Barcode duplikat: task pertama dibuka." : "Task dibuka di tab baru.");
		} catch {
			tab?.close();
			setMessage("Task tidak dapat dicari. Coba lagi.");
		} finally {
			finding.current = false;
			setIsFinding(false);
			focusInput();
		}
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void findTask(code);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-8">
			<header className="mb-7 pt-3">
				<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Production scanner</p>
				<h1 className="text-3xl font-black tracking-tight">Buka task ClickUp</h1>
				<p className="mt-2 text-sm text-muted-foreground">Scan barcode untuk membuka task Produksi.</p>
			</header>

			<form onSubmit={submit}>
				<label htmlFor="barcode" className="mb-2 block text-sm font-semibold">Barcode</label>
				<div className="flex gap-2">
					<Input
						id="barcode"
						value={code}
						onChange={(event) => setCode(event.target.value)}
						placeholder="Scan atau masukkan barcode"
						autoComplete="off"
						disabled={isFinding}
					/>
					<Button type="submit" disabled={isFinding || !code.trim()}>
						<ExternalLink className="size-4" /> Buka
					</Button>
				</div>
			</form>
			{message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}

			<div className="mt-6">
				<Scanner onDetected={findTask} disabled={isFinding} />
			</div>
			<p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
				<ScanBarcode className="size-4" /> USB scanner siap dipakai; gunakan kamera bila perlu.
			</p>
		</main>
	);
}
