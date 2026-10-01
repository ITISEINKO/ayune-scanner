"use client";

import { useState } from "react";
import {
	MapPin,
	Minus,
	PackagePlus,
	Plus,
	SquareArrowRightExit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { TransactionType } from "@/lib/stock";

export type Product = {
	id: string;
	name: string;
	sku: string;
	currentStock: number;
	rak: string;
	brand: string;
};
type Props = {
	product: Product;
	onClose: () => void;
	onSubmit: (data: {
		type: TransactionType;
		qty: number;
		operator: string;
		notes: string;
	}) => Promise<void>;
};

export function ProductSheet({ product, onClose, onSubmit }: Props) {
	const [type, setType] = useState<TransactionType>("IN");
	const [qty, setQty] = useState(1);
	const [operator, setOperator] = useState("");
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);
	const submit = async () => {
		if (!operator.trim()) return;
		setSaving(true);
		try {
			await onSubmit({
				type,
				qty,
				operator: operator.trim(),
				notes: notes.trim(),
			});
		} finally {
			setSaving(false);
		}
	};

	return (
		<Drawer
			open
			onOpenChange={(open) => !open && onClose()}
			snapPoints={["32rem", 1]}
			showSwipeHandle
		>
			<DrawerContent className="max-h-[calc(100dvh-1rem)] rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="flex-1 overflow-y-auto p-5 pb-8">
					<p className="text-sm font-bold text-primary">{product.brand}</p>
					<DrawerTitle className="text-2xl font-bold">
						{product.name}
					</DrawerTitle>
					<DrawerDescription className="sr-only">
						Detail produk dan transaksi stok
					</DrawerDescription>
					<div className="mt-3 flex flex-wrap gap-2">
						<span className="rounded-lg bg-secondary px-3 py-1 font-mono text-sm">
							{product.sku}
						</span>
						<span className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1 text-sm">
							<MapPin className="size-4 text-primary" />
							Rak {product.rak}
						</span>
					</div>
					<div className="my-5 rounded-2xl bg-card p-5 text-center">
						<p className="text-sm text-muted-foreground">Stok Saat Ini</p>
						<p className="mt-1 text-5xl font-black text-card-foreground">
							{product.currentStock}
							<span className="ml-2 text-lg font-medium text-muted-foreground">
								Pcs
							</span>
						</p>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Button
							variant={type === "IN" ? "primary" : "secondary"}
							onClick={() => setType("IN")}
						>
							<PackagePlus className="mr-1 inline size-5" />
							Barang Masuk
						</Button>
						<Button
							variant={type === "OUT" ? "danger" : "secondary"}
							onClick={() => setType("OUT")}
						>
							<SquareArrowRightExit className="mr-1 inline size-5" />
							Barang Keluar
						</Button>
					</div>
					<label className="mt-5 block text-sm font-semibold">
						Jumlah
						<div className="mt-2 flex items-center gap-3">
							<button
								type="button"
								className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground transition hover:bg-muted"
								onClick={() => setQty((current) => Math.max(1, current - 1))}
								aria-label="Kurangi jumlah"
							>
								<Minus className="size-5" />
							</button>
							<Input
								className="text-center tabular-nums"
								type="number"
								min="1"
								inputMode="numeric"
								value={qty}
								onChange={(event) =>
									setQty(Math.max(1, Number(event.target.value) || 1))
								}
							/>
							<button
								type="button"
								className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground transition hover:bg-muted"
								onClick={() => setQty((current) => current + 1)}
								aria-label="Tambah jumlah"
							>
								<Plus className="size-5" />
							</button>
						</div>
					</label>
					<div className="mt-2 grid grid-cols-3 gap-2">
						{[1, 5, 10].map((value) => (
							<Button
								key={value}
								variant="secondary"
								onClick={() => setQty((current) => current + value)}
							>
								<Plus className="mr-1 inline size-4" />
								{value}
							</Button>
						))}
					</div>
					<label className="mt-5 block text-sm font-semibold">
						Nama operator
						<Input
							className="mt-2"
							placeholder="Contoh: Budi"
							value={operator}
							onChange={(event) => setOperator(event.target.value)}
						/>
					</label>
					<label className="mt-4 block text-sm font-semibold">
						Catatan{" "}
						<span className="font-normal text-muted-foreground">
							(opsional)
						</span>
						<textarea
							className="mt-2 min-h-20 w-full rounded-xl border border-input bg-card p-3 outline-none focus:border-ring"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
						/>
					</label>
					<Button
						className="mt-5 w-full text-base"
						onClick={() => void submit()}
						disabled={saving || !operator.trim()}
					>
						{saving ? "Menyimpan..." : "SIMPAN TRANSAKSI"}
					</Button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
