"use client";

import { type SubmitEvent, useRef, useState } from "react";
import { ArrowLeft, Barcode, ExternalLink } from "lucide-react";
import { Scanner } from "@/components/scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PpicRole } from "@/types/ppic";

export const ScanToFindPage = ({ role }: { role: PpicRole }) => {
	const lastScan = useRef(0);
	const finding = useRef(false);
	const [serialNumber, setSerialNumber] = useState("");
	const [message, setMessage] = useState("");
	const [isFinding, setIsFinding] = useState(false);

	const focusInput = () => {
		requestAnimationFrame(() =>
			document.getElementById("serial-number")?.focus(),
		);
	};
	const findTask = async (value: string) => {
		const code = value.trim();
		const now = Date.now();
		if (!code || finding.current || now - lastScan.current < 1_000) return;
		finding.current = true;
		lastScan.current = now;
		setSerialNumber("");
		setIsFinding(true);
		setMessage("Mencari task…");
		const tab = window.open("about:blank", "_blank");

		try {
			const response = await fetch(
				`/api/find-task?serial_number=${encodeURIComponent(code)}`,
			);
			const result = (await response.json()) as {
				url?: string;
				name?: string;
				count?: number;
				error?: string;
			};
			if (!response.ok || !result.url) {
				tab?.close();
				setMessage(
					result.error === "NOT_FOUND"
						? "Serial number tidak terdaftar."
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
					? `${result.name}: serial number duplikat, task pertama dibuka.`
					: `${result.name}: task dibuka di tab baru.`,
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
		void findTask(serialNumber);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg  p-4 pb-28">
			<header className="mb-7">
				<div className="flex items-center gap-4">
					<div className="size-19 shrink-0 overflow-hidden">
						<img src="/icon.svg" alt="" className="size-full" />
					</div>
					<div>
						<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
							{role === "ADMIN" ? "Admin" : role === "SUPER_ADMIN" ? "Super Admin" : "Member"}
						</p>
						<h1 className="text-xl font-black tracking-tight">
							Buka Task Produksi Panel
						</h1>
					</div>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					Scan Serial Number untuk membuka task Produksi Panel di Clickup
				</p>
			</header>

			<Scanner onDetected={findTask} disabled={isFinding} />
			<div className="mt-4 rounded-2xl border border-border/30 bg-card p-4 text-card-foreground shadow-sm/20">
				<form onSubmit={submit}>
					<label
						htmlFor="serial-number"
						className="mb-2 block text-sm font-semibold text-muted-foreground"
					>
						Input Serial Number manual
					</label>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Barcode
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								id="serial-number"
								className="pl-11"
								value={serialNumber}
								onChange={(event) => setSerialNumber(event.target.value)}
								placeholder="Masukkan Serial Number"
								autoComplete="off"
								disabled={isFinding}
							/>
						</div>
						<Button type="submit" disabled={isFinding || !serialNumber.trim()}>
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
