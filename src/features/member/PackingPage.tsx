"use client";

import { useRef, useState } from "react";
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
import type { SelectedProject } from "@/types/project";

export const PackingPage = ({ project }: { project: SelectedProject }) => {
	const busy = useRef(false);
	const [scanning, setScanning] = useState(false);
	const [packedItem, setPackedItem] = useState<string | null>(null);
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

	const pack = async (value: string) => {
		const code = value.trim();
		if (!code || busy.current) return;
		busy.current = true;
		setScanning(true);
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

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-28">
			<MemberScanHeader
				section="Packing barang"
				title="Scan barang dipacking"
				status="SEDANG DIPACKING"
			/>
			<ProjectScope project={project} />

			<Scanner onDetected={pack} autoStart disabled={scanning} />
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
