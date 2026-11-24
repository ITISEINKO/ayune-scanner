"use client";

import { type SubmitEvent, useRef, useState } from "react";
import { Barcode, ExternalLink } from "lucide-react";
import { Scanner } from "@/components/scanner";
import { PageHeader } from "@/components/pageHeader";
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
		<main className="mx-auto min-h-dvh max-w-lg pb-28">
			<PageHeader
				eyebrow={
					role === "ADMIN"
						? "Admin"
						: role === "SUPER_ADMIN"
							? "Super Admin"
							: "Member"
				}
				title="Buka Task Produksi Panel"
			>
				<p className="relative mt-2 text-sm text-muted-foreground">
					Scan Serial Number untuk membuka task Produksi Panel di Clickup
				</p>
			</PageHeader>

			<div className="space-y-4 px-4 pt-5">
				<Scanner onDetected={findTask} disabled={isFinding} />

				{message && (
					<p role="status" className="text-sm text-muted-foreground">
						{message}
					</p>
				)}
			</div>
		</main>
	);
};
