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

export const PackingPage = () => {
	const busy = useRef(false);
	const [serialNumber, setSerialNumber] = useState("");
	const [scanning, setScanning] = useState(false);
	const [packedItem, setPackedItem] = useState<string | null>(null);
	const messageFor = (error?: string) =>
		({
			MISSING_SERIAL_NUMBER: "Serial number wajib diisi.",
			SERIAL_NUMBER_NOT_FOUND: "Serial number tidak ditemukan.",
			DUPLICATE_SERIAL_NUMBER: "Serial number terdaftar lebih dari satu kali.",
			CLICKUP_STATUS_UPDATE_FAILED: "Status Barang Scan gagal diperbarui.",
			RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi sebentar.",
			UNAUTHORIZED: "Sesi login sudah berakhir. Silakan login kembali.",
		})[error ?? ""] ?? "Status barang tidak dapat diperbarui.";

	const pack = async (value: string) => {
		const code = value.trim();
		if (!code || busy.current) return;
		busy.current = true;
		setScanning(true);
		setSerialNumber("");
		try {
			const response = await fetch("/api/panel/scan", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					serial_number: code,
					status: "SEDANG_DIPACKING",
				}),
			});
			const data = (await response.json()) as { nama?: string; error?: string };
			if (!response.ok) throw new Error(messageFor(data.error));
			setPackedItem(data.nama ?? code);
		} catch (error) {
			toast.error("Status tidak berubah", {
				description:
					error instanceof Error
						? error.message
						: "Status barang tidak dapat diperbarui.",
			});
		} finally {
			busy.current = false;
			setScanning(false);
		}
	};

	const submit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		void pack(serialNumber);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-28">
			<header className="mb-7">
				<div className="flex items-center gap-4">
					<div className="size-19 shrink-0 overflow-hidden">
						<img src="/icon.svg" alt="" className="size-full" />
					</div>
					<div>
						<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
							Packing barang
						</p>
						<h1 className="text-xl font-black capitalize tracking-tight">
							Scan barang dipacking
						</h1>
					</div>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					Scan Serial Number untuk mengubah Status Barang Scan menjadi Sedang
					Dipacking.
				</p>
			</header>

			<Scanner onDetected={pack} autoStart disabled={scanning} />
			<div className="mt-4 rounded-3xl border border-border/30 shadow-[0_8px_24px_-14px_rgb(31_26_20/0.24)] bg-card p-4 text-card-foreground">
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
								disabled={scanning}
							/>
						</div>
						<Button type="submit" disabled={!serialNumber.trim() || scanning}>
							{scanning ? (
								<>
									<span aria-hidden="true" className="loader" />
									<span className="sr-only">Memproses Serial Number</span>
								</>
							) : (
								"Proses"
							)}
						</Button>
					</div>
				</form>
			</div>
			<Dialog
				open={Boolean(packedItem)}
				onOpenChange={(open) => !open && setPackedItem(null)}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Status berhasil diubah</DialogTitle>
						<DialogDescription>{packedItem}</DialogDescription>
					</DialogHeader>
					<div className="flex justify-center">
						<Badge className="text-md">SEDANG DIPACKING</Badge>
					</div>
					<DialogFooter>
						<DialogClose render={<Button />}>OK</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
};
