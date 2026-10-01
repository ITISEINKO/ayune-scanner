"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { Scanner } from "@/components/scanner";
import {
	ProductionSheet,
	type ProductionItem,
} from "@/components/productionSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ScannerPage() {
	const [production, setProduction] = useState<ProductionItem | null>(null);
	const [online, setOnline] = useState(true);
	const [scannerCycle, setScannerCycle] = useState(0);
	const [manualBarcode, setManualBarcode] = useState("");
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
		if (!navigator.onLine) {
			notify("Tidak ada koneksi internet.", true);
			restartScanner();
			return;
		}
		try {
			const response = await fetch(
				`/api/produksi/${encodeURIComponent(barcode)}`,
			);
			const result = (await response.json()) as { ok?: boolean; data?: ProductionItem; error?: string };
			if (response.status === 404) {
				const message = `Barcode ${barcode} tidak ditemukan di Produksi.`;
				notify(message, true);
				restartScanner();
				return;
			}
			if (!response.ok || !result.ok || !result.data) throw new Error(result.error ?? "Data produksi tidak dapat dicari.");
			setProduction(result.data);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Data produksi tidak dapat dicari.";
			notify(message, true);
			restartScanner();
		}
	};
	const submitManualBarcode = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const barcode = manualBarcode.trim();
		if (!barcode) return;
		setManualBarcode("");
		void findProduction(barcode);
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-8">
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
							scannow
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
				disabled={!online || Boolean(production)}
			/>
			<form className="mt-4" onSubmit={submitManualBarcode}>
				<label
					htmlFor="manual-barcode"
					className="mb-2 block text-sm font-semibold"
				>
					Input barcode manual
				</label>
				<div className="flex gap-2">
					<Input
						id="manual-barcode"
						value={manualBarcode}
						onChange={(event) => setManualBarcode(event.target.value)}
						placeholder="Masukkan barcode"
						autoComplete="off"
						disabled={!online || Boolean(production)}
					/>
					<Button
						type="submit"
						disabled={!online || Boolean(production) || !manualBarcode.trim()}
					>
						Cari
					</Button>
				</div>
			</form>
			<p className="mt-5 text-center text-xs text-muted-foreground">
				Arahkan kamera ke barcode produk. Kamera otomatis berhenti setelah kode
				terbaca.
			</p>
			{production && (
				<ProductionSheet production={production} onClose={restartScanner} onUpdated={() => void findProduction(production.barcode)} />
			)}
		</main>
	);
}
