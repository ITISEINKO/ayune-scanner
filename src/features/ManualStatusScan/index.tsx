"use client";

import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { Barcode, CloudOff } from "lucide-react";
import { Scanner } from "@/components/scanner";
import {
	StatusChange,
	type ProductionItem,
} from "@/features/ManualStatusScan/StatusChange";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const ManualStatusScanPage = () => {
	const [production, setProduction] = useState<ProductionItem | null>(null);
	const [online, setOnline] = useState(true);
	const [scannerCycle, setScannerCycle] = useState(0);
	const [manualBarcode, setManualBarcode] = useState("");
	const finding = useRef(false);
	const [isFinding, setIsFinding] = useState(false);
	const restartScanner = () => {
		setProduction(null);
		setScannerCycle((value) => value + 1);
	};
	const notify = (message: string, error = false) => {
		if (error) toast.error("Terjadi kesalahan", { description: message });
		else toast.success("Berhasil", { description: message });
	};

	useEffect(() => {
		const updateConnection = () => {
			setOnline(navigator.onLine);
			if (!navigator.onLine)
				notify("Koneksi terputus. Scanner menunggu internet.", true);
		};
		updateConnection();
		window.addEventListener("online", updateConnection);
		window.addEventListener("offline", updateConnection);
		return () => {
			window.removeEventListener("online", updateConnection);
			window.removeEventListener("offline", updateConnection);
		};
	}, []);

	const findProduction = async (barcode: string) => {
		if (finding.current) return;
		if (!navigator.onLine) {
			notify("Tidak ada koneksi internet.", true);
			restartScanner();
			return;
		}
		finding.current = true;
		setIsFinding(true);
		try {
			const response = await fetch(
				`/api/produksi/${encodeURIComponent(barcode)}`,
			);
			const result = (await response.json()) as {
				ok?: boolean;
				data?: ProductionItem;
				error?: string;
				message?: string;
			};
			if (response.status === 404) {
				const message = `Barcode ${barcode} tidak ditemukan di Produksi.`;
				notify(message, true);
				restartScanner();
				return;
			}
			if (!response.ok || !result.ok || !result.data)
				throw new Error(
					result.message ?? result.error ?? "Data produksi tidak dapat dicari.",
				);
			setProduction(result.data);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Data produksi tidak dapat dicari.";
			notify(message, true);
			restartScanner();
		} finally {
			finding.current = false;
			setIsFinding(false);
		}
	};
	const submitManualBarcode = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		const barcode = manualBarcode.trim();
		if (!barcode) return;
		setManualBarcode("");
		void findProduction(barcode);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-28">
			<header className="mb-7  pt-3">
				<div className="flex items-center gap-4">
					<div className="size-10 shrink-0 overflow-hidden">
						<img src="/icon.svg" alt="" className="size-full " />
					</div>
					<div>
						<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
							Production scanner
						</p>
						<h1 className="text-3xl font-black tracking-tight uppercase">
							TrackerProd
						</h1>
					</div>
				</div>
			</header>
			{!online && (
				<div
					role="alert"
					className="mb-4 flex gap-2 rounded-xl border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
				>
					<CloudOff className="size-5 shrink-0" />
					Offline — sambungkan internet untuk mencari dan menyimpan data.
				</div>
			)}
			<Scanner
				onDetected={findProduction}
				autoStart={scannerCycle > 0}
				disabled={!online || Boolean(production) || isFinding}
			/>
			<div className="rounded-3xl mt-4 border border-border bg-card p-4 text-card-foreground shadow-2xl">
				<form onSubmit={submitManualBarcode}>
					<label
						htmlFor="manual-barcode"
						className="mb-2 block text-sm  text-muted-foreground font-semibold"
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
								id="manual-barcode"
								className="pl-11"
								value={manualBarcode}
								onChange={(event) => setManualBarcode(event.target.value)}
								placeholder="Masukkan barcode"
								autoComplete="off"
								disabled={!online || Boolean(production) || isFinding}
							/>
						</div>
						<Button
							type="submit"
							disabled={
								!online || Boolean(production) || isFinding || !manualBarcode.trim()
							}
						>
							{isFinding ? (
								<>
									<span aria-hidden="true" className="loader" />
									<span className="sr-only">Mencari barcode</span>
								</>
							) : (
								"Cari"
							)}
						</Button>
					</div>
				</form>
			</div>
			<p className="mt-5 text-center text-xs text-muted-foreground">
				Arahkan kamera ke barcode produk. Kamera otomatis berhenti setelah kode
				terbaca.
			</p>
			{production && (
				<StatusChange
					production={production}
					onClose={restartScanner}
					onUpdated={() => void findProduction(production.barcode)}
				/>
			)}
		</main>
	);
};
