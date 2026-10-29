"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
import { PanelLocationViewer } from "@/features/panel-location/PanelLocationViewer";
import type { ManualPanelItem } from "@/types/panelLocation";
import { panelDisplayName } from "@/lib/panelLocation";

const messageFor = (error?: string) =>
	({
		SERIAL_NUMBER_NOT_FOUND: "Serial number tidak ditemukan.",
		DUPLICATE_SERIAL_NUMBER: "Serial number terdaftar lebih dari satu kali.",
		CLICKUP_FIELD_MISSING: "Field Status Barang Scan tidak tersedia.",
		RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi sebentar.",
		UNAUTHORIZED: "Sesi login sudah berakhir. Silakan login kembali.",
		LOCATION_AMBIGUOUS: "Serial ditemukan di beberapa model aktif. Periksa model LBY di profil admin.",
		LOCATION_UNAVAILABLE: "Lokasi panel belum dapat dimuat. Coba lagi sebentar.",
	})[error ?? ""] ?? "Data barang tidak dapat diproses.";

export const UbahManualPage = ({ serialNumber }: { serialNumber?: string }) => {
	const router = useRouter();
	const finding = useRef(false);
	const savingRef = useRef(false);
	const [item, setItem] = useState<ManualPanelItem | null>(null);
	const [selectedStatus, setSelectedStatus] = useState("");
	const [loading, setLoading] = useState(Boolean(serialNumber));
	const [saving, setSaving] = useState(false);
	const [editing, setEditing] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const findItem = (value: string) => {
		const code = value.trim();
		if (!code || finding.current) return;
		if (code.length > 100) {
			toast.error("Serial number terlalu panjang.");
			return;
		}
		finding.current = true;
		setLoading(true);
		router.push(
			`/admin/ubah-manual/location?${new URLSearchParams({ barcode: code })}`,
		);
	};
	useEffect(() => {
		if (!serialNumber) return;
		const controller = new AbortController();
		const load = async () => {
			try {
				const response = await fetch(
					`/api/panel/manual?${new URLSearchParams({ serial_number: serialNumber })}`,
					{
						signal: controller.signal,
					},
				);
				const data = (await response.json()) as {
					data?: ManualPanelItem;
					error?: string;
				};
				if (!response.ok || !data.data) throw new Error(messageFor(data.error));
				setItem(data.data);
			} catch (error) {
				if (!controller.signal.aborted)
					setErrorMessage(
						error instanceof Error ? error.message : messageFor(),
					);
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		};
		void load();
		return () => controller.abort();
	}, [serialNumber]);
	const save = async () => {
		if (!item?.task_id || !selectedStatus || savingRef.current) return;
		savingRef.current = true;
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
			savingRef.current = false;
			setSaving(false);
		}
	};
	const locatedPanel = item?.location?.panels.find(
		(panel) => panel.barcode === item.serial_number,
	);

	return (
		<main
			className={
				serialNumber
					? "relative mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-neutral-50 pb-(--bottom-navigation-height) dark:bg-background"
					: "mx-auto min-h-dvh max-w-lg p-4 pb-28"
			}
		>
			{serialNumber ? (
				<header className="absolute inset-x-3 top-3 z-20 flex min-w-0 items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="h-10 rounded-full border-border/50 bg-card/95 px-3 shadow-sm"
						nativeButton={false}
						render={<Link href="/admin/ubah-manual" />}
					>
						<ArrowLeft aria-hidden="true" data-icon="inline-start" />
						Scan panel lain
					</Button>
					<h1
						title={
							item?.location
								? `${item.location.projectName}${locatedPanel ? ` · ${locatedPanel.roomName}` : ""}`
								: "Lokasi panel"
						}
						className="min-w-0 flex-1 truncate rounded-full border border-border/50 bg-card/95 px-3 py-3 text-center text-[11px] font-bold shadow-sm"
					>
						{item?.location
							? `${item.location.projectName}${locatedPanel ? ` · ${locatedPanel.roomName}` : ""}`
							: "Lokasi panel"}
					</h1>
				</header>
			) : (
				<>
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
							Scan Serial Number untuk menampilkan lokasi item dan mengubah
							statusnya secara manual.
						</p>
					</header>

					<Scanner onDetected={findItem} disabled={loading} />
				</>
			)}
			{loading && serialNumber && (
				<p
					role="status"
					className="flex flex-1 items-center justify-center p-5 text-sm text-muted-foreground"
				>
					Memuat lokasi dan status panel…
				</p>
			)}
			{errorMessage && (
				<p
					role="alert"
					className="mx-4 mt-20 rounded-xl border bg-card p-5 text-sm"
				>
					{errorMessage}
				</p>
			)}
			{item && (
				<>
					{item.location ? (
						<PanelLocationViewer {...item.location} immersive />
					) : (
						<p
							role="status"
							className="flex flex-1 items-center justify-center px-5 pb-8 pt-20 text-sm text-muted-foreground"
						>
							{item.location_error === "LOCATION_AMBIGUOUS"
								? "Serial ditemukan di beberapa model aktif. Periksa model LBY di profil admin. Status barang tetap dapat diubah."
								: item.location_error
									? "Lokasi panel belum dapat dimuat. Status barang tetap dapat diubah."
									: "Lokasi panel belum tersedia untuk project ini. Status barang tetap dapat diubah."}
						</p>
					)}
					<section
						aria-label="Status barang"
						className="relative z-10 shrink-0 rounded-t-[1.75rem] border border-b-0 border-border/60 bg-card px-5 pb-5
						 pt-5 shadow-[0_-6px_24px_-14px_rgb(31_26_20/0.12)]"
					>
						<div className="flex items-start justify-between gap-3">
							<h2 className="min-w-0 flex-1 text-lg font-extrabold leading-snug">
								{panelDisplayName(item.nama, locatedPanel?.panelNumber ? `Panel ${locatedPanel.panelNumber}` : "Panel")}
							</h2>
							<Badge
								title={item.status ? `Status saat ini: ${item.status}` : "Task ClickUp belum ditemukan"}
								className="max-w-[55%] gap-1.5 rounded-full bg-accent/20 px-2.5 py-1.5 text-[10px] font-bold text-foreground"
							>
								<span
									aria-hidden="true"
									className="size-1.5 shrink-0 rounded-full bg-primary"
								/>
								<span className="truncate">{item.status ?? "STATUS TIDAK TERSEDIA"}</span>
							</Badge>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{locatedPanel?.panelNumber
								? `Panel ${locatedPanel.panelNumber} · `
								: ""}
							Serial: {item.serial_number}
						</p>
						<Button
							className="mt-4 w-full rounded-xl"
							disabled={!item.task_id}
							onClick={() => setEditing(true)}
						>
							Ubah status barang
						</Button>
						{!item.task_id && <p className="mt-2 text-xs text-muted-foreground">Lokasi tersedia di LBY. Task ClickUp untuk serial ini belum ditemukan, jadi status belum dapat diubah.</p>}
					</section>
				</>
			)}

			{item?.task_id && (
				<Drawer
					open={editing}
					onOpenChange={(open) => {
						setEditing(open);
						if (!open) setSelectedStatus("");
					}}
					showSwipeHandle
				>
					<DrawerContent className="[--drawer-inset:0px]! mx-auto max-w-lg rounded-t-[1.75rem] border-t border-border bg-card shadow-2xl">
						<div className="min-h-0 flex-1 overflow-y-auto p-5 pb-8">
							<Badge className="mb-3 bg-accent">
								Serial: {item.serial_number}
							</Badge>
							<DrawerTitle className="text-2xl font-bold">
								{panelDisplayName(item.nama)}
							</DrawerTitle>
							<DrawerDescription className="mt-1">
								Pilih status baru untuk barang ini.
							</DrawerDescription>
							<div className="my-6 rounded-2xl bg-card p-5 text-center">
								<p className="text-sm text-muted-foreground">Status saat ini</p>
								<p className="mt-1 text-2xl font-black">{item.status}</p>
							</div>
							<StatusPicker
								currentStatus={item.status ?? ""}
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
