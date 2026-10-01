"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import Link from "next/link";
import { Scanner } from "@/components/scanner";
import { NewProductSheet } from "@/components/new-product-sheet";
import { ProductSheet, type Product } from "@/components/product-sheet";
import { toast } from "sonner";
import type { TransactionType } from "@/lib/stock";

export default function ScannerPage() {
	const [product, setProduct] = useState<Product | null>(null);
	const [missingSku, setMissingSku] = useState<string | null>(null);
	const [online, setOnline] = useState(true);
	const [scannerCycle, setScannerCycle] = useState(0);
	const restartScanner = () => {
		setProduct(null);
		setMissingSku(null);
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

	const findProduct = async (sku: string) => {
		if (!navigator.onLine) {
			notify("Tidak ada koneksi internet.", true);
			restartScanner();
			return;
		}
		try {
			const response = await fetch(
				`/api/product/search?sku=${encodeURIComponent(sku)}`,
			);
			const data = (await response.json()) as Product & { error?: string };
			if (response.status === 404) {
				setMissingSku(sku);
				return;
			}
			if (!response.ok) throw new Error(data.error);
			setProduct(data);
		} catch (error) {
			notify(
				error instanceof Error ? error.message : "Produk tidak dapat dicari.",
				true,
			);
			restartScanner();
		}
	};

	const saveTransaction = async ({
		type,
		qty,
		operator,
		notes,
	}: {
		type: TransactionType;
		qty: number;
		operator: string;
		notes: string;
	}) => {
		if (!product) return;
		const response = await fetch("/api/stock/transaction", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				taskId: product.id,
				sku: product.sku,
				type,
				qty,
				operator,
				notes,
				currentStock: product.currentStock,
			}),
		});
		const data = (await response.json()) as {
			newStock?: number;
			error?: string;
		};
		if (!response.ok) {
			notify(data.error ?? "Transaksi gagal disimpan.", true);
			return;
		}
		notify(`Stok berhasil diperbarui menjadi ${data.newStock}`);
		restartScanner();
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-8">
			<header className="mb-7  pt-3">
				<div className="flex items-center gap-3">
					<div className="size-14 shrink-0 overflow-hidden">
						<img src="/icon.svg" alt="" className="size-full scale-[1.2]" />
					</div>
					<div>
						<p className="text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">
							Warehouse scanner
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
				onDetected={findProduct}
				autoStart={scannerCycle > 0}
				disabled={!online || Boolean(product || missingSku)}
			/>
			<p className="mt-5 text-center text-xs text-muted-foreground">
				Arahkan kamera ke barcode produk. Kamera otomatis berhenti setelah kode
				terbaca.
			</p>
			{process.env.NODE_ENV === "development" && (
				<Link
					href="/preview"
					className="mt-3 w-full text-center text-xs text-muted-foreground underline"
				>
					Preview hasil scan
				</Link>
			)}
			{product && (
				<ProductSheet
					product={product}
					onClose={restartScanner}
					onSubmit={saveTransaction}
				/>
			)}
			{missingSku && (
				<NewProductSheet
					sku={missingSku}
					onClose={restartScanner}
					onCreated={(createdProduct) => {
						setMissingSku(null);
						setProduct(createdProduct);
					}}
				/>
			)}
		</main>
	);
}
