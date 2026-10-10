"use client";

import { type SubmitEvent, useRef, useState } from "react";
import { Barcode } from "lucide-react";
import { toast } from "sonner";
import { ProjectScope } from "@/components/projectScope";
import { MemberScanHeader } from "@/components/memberScanHeader";
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
import type { SelectedProject } from "@/types/project";

export const BarangDiterimaPage = ({ project }: { project: SelectedProject }) => {
	const busy = useRef(false);
	const [serialNumber, setSerialNumber] = useState("");
	const [scanning, setScanning] = useState(false);
	const [receivedItem, setReceivedItem] = useState<string | null>(null);
	const messageFor = (error?: string) =>
		({
			MISSING_SERIAL_NUMBER: "Serial number wajib diisi.",
			SERIAL_NUMBER_NOT_FOUND: "Serial number tidak ditemukan.",
			DUPLICATE_SERIAL_NUMBER: "Serial number terdaftar lebih dari satu kali.",
			CLICKUP_STATUS_UPDATE_FAILED: "Status Barang Scan gagal diperbarui.",
			SCAN_HISTORY_SAVE_FAILED:
				"Status sudah diubah, tetapi riwayat belum tersimpan. Scan ulang serial ini.",
			RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi sebentar.",
			NO_SELECTED_PROJECT: "Pilih project sebelum mulai scan.",
			SERIAL_NOT_IN_SELECTED_PROJECT: "Serial number bukan bagian dari project aktif.",
			INVALID_TASK_HIERARCHY: "Data hierarchy serial tidak valid.",
			UNAUTHORIZED: "Sesi login sudah berakhir. Silakan login kembali.",
		})[error ?? ""] ?? "Status barang tidak dapat diperbarui.";

	const receive = async (value: string) => {
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
					status: "BARANG_DITERIMA",
				}),
			});
			const data = (await response.json()) as { nama?: string; error?: string };
			if (!response.ok) throw new Error(messageFor(data.error));
			setReceivedItem(data.nama ?? code);
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
		void receive(serialNumber);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-28">
			<MemberScanHeader
				section="Penerimaan barang"
				title="Scan Barang diterima"
				status="BARANG DITERIMA"
			/>
			<ProjectScope project={project} />

			<Scanner onDetected={receive} autoStart disabled={scanning} />
			<div className="mt-4 rounded-3xl border border-border/30 bg-card p-4 text-card-foreground shadow-md/40">
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
				open={Boolean(receivedItem)}
				onOpenChange={(open) => !open && setReceivedItem(null)}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Status berhasil diubah</DialogTitle>
						<DialogDescription>{receivedItem}</DialogDescription>
					</DialogHeader>
					<div className="flex justify-center">
						<Badge className="text-md">BARANG DITERIMA</Badge>
					</div>
					<DialogFooter>
						<DialogClose render={<Button />}>OK</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
};
