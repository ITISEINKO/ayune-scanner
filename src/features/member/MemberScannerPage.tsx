"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProjectScope } from "@/components/projectScope";
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
import { statusBarangScanOptions } from "@/lib/produksiPanel";
import type { PpicStatus, PpicStatuses } from "@/types/ppic";
import type { SelectedProject } from "@/types/project";

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
		SERIAL_NOT_IN_SELECTED_PROJECT:
			"Serial number bukan bagian dari project aktif.",
		INVALID_TASK_HIERARCHY: "Data hierarchy serial tidak valid.",
		UNAUTHORIZED: "Sesi login sudah berakhir. Silakan login kembali.",
	})[error ?? ""] ?? "Status barang tidak dapat diperbarui.";

const labelFor = (status: PpicStatus) =>
	statusBarangScanOptions.find((option) => option.key === status)?.label ??
	status.replaceAll("_", " ");

export const MemberScannerPage = ({
	project,
	allowedStatuses,
}: {
	project: SelectedProject;
	allowedStatuses: PpicStatuses;
}) => {
	const busy = useRef(false);
	const [scanning, setScanning] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState(allowedStatuses[0]);
	const [scannedItem, setScannedItem] = useState<string | null>(null);
	const [scannedStatus, setScannedStatus] = useState<PpicStatus | null>(null);

	const scan = async (value: string) => {
		const code = value.trim();
		if (!code || !selectedStatus || busy.current) return;
		busy.current = true;
		setScanning(true);
		try {
			const response = await fetch("/api/panel/scan", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ serial_number: code, status: selectedStatus }),
			});
			const data = (await response.json()) as { nama?: string; error?: string };
			if (!response.ok) throw new Error(messageFor(data.error));
			setScannedItem(data.nama ?? code);
			setScannedStatus(selectedStatus);
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
		<main className="mx-auto min-h-dvh max-w-lg  pb-28">
			<ProjectScope project={project} />
			<div className="p-4">
				<Scanner
					onDetected={scan}
					autoStart
					disabled={scanning}
					statuses={allowedStatuses}
					selectedStatus={selectedStatus}
					onStatusChange={setSelectedStatus}
				/>
				<Dialog
					open={Boolean(scannedItem)}
					onOpenChange={(open) => !open && setScannedItem(null)}
				>
					<DialogContent showCloseButton={false}>
						<DialogHeader>
							<DialogTitle>Status berhasil diubah</DialogTitle>
							<DialogDescription>{scannedItem}</DialogDescription>
						</DialogHeader>
						<div className="flex justify-center">
							<Badge className="text-md">
								{scannedStatus ? labelFor(scannedStatus) : ""}
							</Badge>
						</div>
						<DialogFooter>
							<DialogClose render={<Button />}>OK</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</main>
	);
};
