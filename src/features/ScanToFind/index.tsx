"use client";

import { type SubmitEvent, useRef, useState } from "react";
import { ArrowLeft, Barcode, ExternalLink } from "lucide-react";
import { Scanner } from "@/components/scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const ScanToFindPage = () => {
	const lastScan = useRef(0);
	const finding = useRef(false);
	const [batchNumber, setBatchNumber] = useState("");
	const [message, setMessage] = useState("");
	const [isFinding, setIsFinding] = useState(false);

	const focusInput = () => {
		requestAnimationFrame(() =>
			document.getElementById("batch-number")?.focus(),
		);
	};
	const findTask = async (value: string) => {
		const code = value.trim();
		const now = Date.now();
		if (!code || finding.current || now - lastScan.current < 1_000) return;
		finding.current = true;
		lastScan.current = now;
		setBatchNumber("");
		setIsFinding(true);
		setMessage("Mencari task…");
		const tab = window.open("about:blank", "_blank");

		try {
			const response = await fetch(
				`/api/find-task?batch_number=${encodeURIComponent(code)}`,
			);
			const result = (await response.json()) as {
				url?: string;
				count?: number;
				error?: string;
			};
			if (!response.ok || !result.url) {
				tab?.close();
				setMessage(
					result.error === "NOT_FOUND"
						? "Batch number tidak terdaftar."
						: "Task tidak dapat dicari. Coba lagi.",
				);
				return;
			}
			if (!tab) {
				setMessage("Pop-up diblokir. Izinkan pop-up lalu scan lagi.");
				return;
			}
			tab.location.href = result.url;
			setMessage(
				result.count && result.count > 1
					? "Batch number duplikat: task pertama dibuka."
					: "Task dibuka di tab baru.",
			);
		} catch {
			tab?.close();
			setMessage("Task tidak dapat dicari. Coba lagi.");
		} finally {
			finding.current = false;
			setIsFinding(false);
			focusInput();
		}
	};

	const submit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		void findTask(batchNumber);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-28">
			<header className="mb-7 pt-3">
				<div className="mt-4 flex items-center gap-4">
					<div className="size-10 shrink-0 overflow-hidden">
						<img src="/icon.svg" alt="" className="size-full" />
					</div>
					<div>
						<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
							PPIC admin
						</p>
						<h1 className="text-2xl font-black tracking-tight">
							Buka task PPIC
						</h1>
					</div>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					Scan Batch Number untuk membuka task PPIC.
				</p>
			</header>

			<Scanner onDetected={findTask} disabled={isFinding} />
			<div className="mt-4 rounded-3xl border border-border bg-card p-4 text-card-foreground shadow-2xl">
				<form onSubmit={submit}>
					<label
						htmlFor="batch-number"
						className="mb-2 block text-sm font-semibold text-muted-foreground"
					>
						Input Batch Number manual
					</label>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Barcode
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								id="batch-number"
								className="pl-11"
								value={batchNumber}
								onChange={(event) => setBatchNumber(event.target.value)}
								placeholder="Masukkan Batch Number"
								autoComplete="off"
								disabled={isFinding}
							/>
						</div>
						<Button type="submit" disabled={isFinding || !batchNumber.trim()}>
							{isFinding ? (
								<>
									<span aria-hidden="true" className="loader" />
									<span className="sr-only">Mencari task</span>
								</>
							) : (
								<>
									<ExternalLink className="size-4" /> Buka
								</>
							)}
						</Button>
					</div>
				</form>
			</div>
			{message && (
				<p role="status" className="mt-3 text-sm text-muted-foreground">
					{message}
				</p>
			)}
		</main>
	);
};
