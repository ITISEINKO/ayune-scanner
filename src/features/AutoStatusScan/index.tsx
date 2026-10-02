"use client";

import { type SubmitEvent, useRef, useState } from "react";
import { ArrowLeft, Barcode } from "lucide-react";
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
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-28">
			<header className="mb-7 pt-3">
				<Button
					variant="ghost"
					size="sm"
					nativeButton={false}
					render={<a href="/" />}
				>
					<ArrowLeft /> Kembali
				</Button>
				<div className="mt-4 flex items-center gap-4">
					<div className="size-10 shrink-0 overflow-hidden">
						<img src="/icon.svg" alt="" className="size-full" />
					</div>
					<div>
						<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
							Update status produk
						</p>
						<h1 className="text-2xl font-black tracking-tight">
							Scan untuk update status
						</h1>
					</div>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					Scan barcode untuk melanjutkan tahap produksi.
				</p>
			</header>

			<Scanner onDetected={advance} autoStart disabled={scanning} />
			<div className="mt-4 rounded-3xl border border-border bg-card p-4 text-card-foreground shadow-2xl">
				<form onSubmit={submit}>
					<label
						htmlFor="barcode"
						className="mb-2 block text-sm font-semibold text-muted-foreground"
					>
						Input barcode manual
					</label>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Barcode
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								id="barcode"
								className="pl-11"
								value={barcode}
								onChange={(event) => setBarcode(event.target.value)}
								placeholder="Masukkan barcode"
								autoComplete="off"
								disabled={scanning}
							/>
						</div>
						<Button type="submit" disabled={!barcode.trim() || scanning}>
							{scanning ? (
								<>
									<span aria-hidden="true" className="loader" />
									<span className="sr-only">Memproses barcode</span>
								</>
							) : (
								"Proses"
							)}
						</Button>
					</div>
				</form>
			</div>
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
						<Badge variant="secondary" className="text-md">
							{statusChange?.from}
						</Badge>
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
