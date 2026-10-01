"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { Product } from "@/components/product-sheet";

type Props = {
	sku: string;
	onClose: () => void;
	onCreated: (product: Product) => void;
};

export function NewProductSheet({ sku, onClose, onCreated }: Props) {
	const [name, setName] = useState("");
	const [brand, setBrand] = useState("");
	const [rak, setRak] = useState("");
	const [currentStock, setCurrentStock] = useState(0);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const submit = async () => {
		if (!name.trim() || !brand.trim() || !rak.trim()) return;
		setSaving(true);
		setError("");
		try {
			const response = await fetch("/api/product", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sku,
					name: name.trim(),
					brand: brand.trim(),
					rak: rak.trim(),
					currentStock,
				}),
			});
			const data = (await response.json()) as Product & { error?: string };
			if (!response.ok)
				throw new Error(data.error ?? "Produk tidak dapat ditambahkan.");
			onCreated(data);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "Produk tidak dapat ditambahkan.",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Drawer open onOpenChange={(open) => !open && onClose()} showSwipeHandle>
			<DrawerContent className="max-h-[calc(100dvh-1rem)] rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="flex-1 overflow-y-auto p-5 pb-8">
					<p className="text-sm font-bold text-primary	">
						Produk belum terdaftar
					</p>
					<DrawerTitle className="text-2xl font-bold">
						Tambah produk baru
					</DrawerTitle>
					<DrawerDescription className="mt-1">
						Barcode ini belum ada di inventaris. Lengkapi detail produk untuk
						menambahkannya.
					</DrawerDescription>
					<label className="mt-5 block text-sm font-semibold">
						SKU / Barcode
						<Input className="mt-2 font-mono" value={sku} readOnly />
					</label>
					<label className="mt-4 block text-sm font-semibold">
						Nama produk
						<Input
							className="mt-2"
							placeholder="Contoh: Kopi Arabika 250 g"
							value={name}
							onChange={(event) => setName(event.target.value)}
							autoFocus
						/>
					</label>
					<div className="mt-4 grid grid-cols-2 gap-3">
						<label className="text-sm font-semibold">
							Brand
							<Input
								className="mt-2"
								placeholder="Contoh: Nusantara"
								value={brand}
								onChange={(event) => setBrand(event.target.value)}
							/>
						</label>
						<label className="text-sm font-semibold">
							Lokasi rak
							<Input
								className="mt-2"
								placeholder="Contoh: A-03"
								value={rak}
								onChange={(event) => setRak(event.target.value)}
							/>
						</label>
					</div>
					<label className="mt-4 block text-sm font-semibold">
						Stok awal
						<Input
							className="mt-2"
							type="number"
							min="0"
							inputMode="numeric"
							value={currentStock}
							onChange={(event) =>
								setCurrentStock(Math.max(0, Number(event.target.value) || 0))
							}
						/>
					</label>
					{error && (
						<p
							role="alert"
							className="mt-4 text-sm font-semibold text-destructive"
						>
							{error}
						</p>
					)}
					<div className="mt-5 grid grid-cols-2 gap-3">
						<Button variant="secondary" onClick={onClose}>
							Batal
						</Button>
						<Button
							onClick={() => void submit()}
							disabled={saving || !name.trim() || !brand.trim() || !rak.trim()}
						>
							<PackagePlus className="mr-1 inline size-5" />
							{saving ? "Menambahkan..." : "Tambah produk"}
						</Button>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
