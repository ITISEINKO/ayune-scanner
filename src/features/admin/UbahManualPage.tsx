"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Scanner } from "@/components/scanner";
import StatusPicker from "@/components/statusPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import { statusBarangScanOptions } from "@/lib/produksiPanel";

export const UbahManualPage = () => {
	const finding = useRef(false);
	const [item, setItem] = useState<Record<string, string> | null>(null);
	const [selectedStatus, setSelectedStatus] = useState("");
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const restart = () => {
		setItem(null);
		setSelectedStatus("");
	};
	const messageFor = (error?: string) =>
		({
			SERIAL_NUMBER_NOT_FOUND: "Serial number tidak ditemukan.",
			DUPLICATE_SERIAL_NUMBER: "Serial number terdaftar lebih dari satu kali.",
			CLICKUP_FIELD_MISSING: "Field Status Barang Scan tidak tersedia.",
			RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi sebentar.",
			UNAUTHORIZED: "Sesi login sudah berakhir. Silakan login kembali.",
		})[error ?? ""] ?? "Data barang tidak dapat diproses.";
	const findItem = async (value: string) => {
		const code = value.trim();
		if (!code || finding.current) return;
		finding.current = true;
		setLoading(true);
		try {
			const response = await fetch(
				`/api/panel/manual?serial_number=${encodeURIComponent(code)}`,
			);
			const data = (await response.json()) as {
				data?: Record<string, string>;
				error?: string;
			};
			if (!response.ok || !data.data) throw new Error(messageFor(data.error));
			setItem(data.data);
		} catch (error) {
			toast.error("Terjadi Kesalahan", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			finding.current = false;
			setLoading(false);
		}
	};
	const save = async () => {
		if (!item || !selectedStatus) return;
		setSaving(true);
		try {
			const response = await fetch("/api/panel/manual", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ task_id: item.task_id, status: selectedStatus }),
			});
			const data = (await response.json()) as {
				status?: string;
				error?: string;
			};
			if (!response.ok || !data.status) throw new Error(messageFor(data.error));
			setItem({ ...item, status: data.status });
			setSelectedStatus("");
			toast.success("Status berhasil diperbarui.");
		} catch (error) {
			toast.error("Gagal memperbarui status", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setSaving(false);
		}
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
							Produksi Panel admin
						</p>
						<h1 className="text-xl font-black capitalize tracking-tight">
							Ubah status barang
						</h1>
					</div>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					Scan Serial Number untuk mencari barang dan mengubah statusnya secara
					manual.
				</p>
			</header>

			<Scanner onDetected={findItem} disabled={Boolean(item) || loading} />

			{item && (
				<Drawer
					open
					onOpenChange={(open) => !open && restart()}
					snapPoints={["28rem", 1]}
					showSwipeHandle
				>
					<DrawerContent className="[--drawer-inset:0px]! mx-auto max-w-lg rounded-t-3xl border-t border-border bg-background shadow-2xl">
						<div className="flex-1 overflow-y-auto p-5 pb-8">
							<Badge className="mb-3 bg-accent">
								Serial: {item.serial_number}
							</Badge>
							<DrawerTitle className="text-2xl font-bold">
								{item.nama}
							</DrawerTitle>
							<DrawerDescription className="mt-1">
								Pilih status baru untuk barang ini.
							</DrawerDescription>
							<div className="my-6 rounded-2xl bg-card p-5 text-center">
								<p className="text-sm text-muted-foreground">Status saat ini</p>
								<p className="mt-1 text-2xl font-black">{item.status}</p>
							</div>
							<StatusPicker
								currentStatus={item.status}
								selectedStatus={selectedStatus}
								onStatusChange={setSelectedStatus}
							/>
							{selectedStatus && (
								<div
									role="alert"
									className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4"
								>
									<p className="font-bold">Ubah status barang?</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{item.status} →{" "}
										{
											statusBarangScanOptions.find(
												(option) => option.key === selectedStatus,
											)?.label
										}
									</p>
									<div className="mt-4 flex gap-2">
										<Button
											type="button"
											className="flex-1"
											variant="outline"
											disabled={saving}
											onClick={() => setSelectedStatus("")}
										>
											Batal
										</Button>
										<Button
											type="button"
											className="flex-1 bg-accent"
											disabled={saving}
											onClick={save}
										>
											{saving ? "Memproses..." : "Ya, ubah status"}
										</Button>
									</div>
								</div>
							)}
						</div>
					</DrawerContent>
				</Drawer>
			)}
		</main>
	);
};
