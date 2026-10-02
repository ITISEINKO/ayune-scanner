"use client";

import { type SubmitEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Scanner } from "@/components/scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const AutoScanPage = () => {
	const busy = useRef(false);
	const [barcode, setBarcode] = useState("");
	const [scanning, setScanning] = useState(false);
	const [statusChange, setStatusChange] = useState<{
		nama: string;
		from: string;
		to: string;
	} | null>(null);
	const messageFor = (error?: string) =>
		error ?? "Status tidak dapat diperbarui.";

	const advance = async (value: string) => {
		const code = value.trim();
		if (!code || busy.current) return;
		busy.current = true;
		setScanning(true);
		setBarcode("");
		try {
			const response = await fetch("/api/produksi/scan", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ barcode: code, action: "advance" }),
			});
			const data = (await response.json()) as {
				nama?: string;
				from?: string;
				to?: string;
				error?: string;
			};
			if (!response.ok || !data.to) throw new Error(messageFor(data.error));
			const change = {
				nama: data.nama ?? code,
				from: data.from ?? "-",
				to: data.to,
			};
			setStatusChange(change);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Status tidak dapat diperbarui.";
			toast.error("Status tidak berubah", { description: message });
		} finally {
			busy.current = false;
			setScanning(false);
		}
	};

	const submit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		void advance(barcode);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-8">
			<header className="mb-7 pt-3">
				<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
					Update status produk
				</p>
				<h1 className="text-3xl font-black tracking-tight">
					Scan untuk update status
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Scan barcode untuk melanjutkan tahap produksi.
				</p>
			</header>

			<div className="mt-6">
				<Scanner onDetected={advance} autoStart disabled={scanning} />
			</div>
			<form className="mt-4 flex gap-2" onSubmit={submit}>
				<Input
					value={barcode}
					onChange={(event) => setBarcode(event.target.value)}
					placeholder="Scan atau masukkan barcode"
					autoComplete="off"
					disabled={scanning}
				/>
				<Button type="submit" disabled={!barcode.trim() || scanning}>
					Proses
				</Button>
			</form>
			<Dialog
				open={Boolean(statusChange)}
				onOpenChange={(open) => !open && setStatusChange(null)}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Status berhasil diubah</DialogTitle>
						<DialogDescription>{statusChange?.nama}</DialogDescription>
					</DialogHeader>
					<div className="flex items-center justify-center gap-2">
						<Badge variant="secondary">{statusChange?.from}</Badge>
						<span aria-hidden="true">→</span>
						<Badge>{statusChange?.to}</Badge>
					</div>
					<DialogFooter>
						<DialogClose render={<Button />}>OK</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
};
