"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { productionSteps } from "@/lib/produksi";

export type ProductionItem = {
	taskId: string;
	nama: string | null;
	barcode: string;
	tahapSekarang: string;
};

type Props = {
	production: ProductionItem;
	onClose: () => void;
	onUpdated: () => void;
};

export function StatusChange({ production, onClose, onUpdated }: Props) {
	const [confirming, setConfirming] = useState(false);
	const [saving, setSaving] = useState(false);
	const [selectedTahap, setSelectedTahap] = useState("");

	const advance = async () => {
		setSaving(true);
		try {
			const form = new FormData();
			form.append("task_id", production.taskId);
			form.append("tahap", selectedTahap);
			const response = await fetch("/api/produksi/advance", {
				method: "POST",
				body: form,
			});
			const data = (await response.json()) as { error?: string };
			if (!response.ok)
				throw new Error(data.error ?? "Status tidak dapat diperbarui.");
			setConfirming(false);
			setSelectedTahap("");
			onUpdated();
			toast.success("Status diperbarui.");
		} catch (error) {
			toast.error("Gagal memperbarui status", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setSaving(false);
		}
	};

	return (
		<Drawer
			open
			onOpenChange={(open) => !open && onClose()}
			snapPoints={["22rem", 1]}
			showSwipeHandle
		>
			<DrawerContent className="rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="p-5 pb-8">
					<DrawerTitle className="text-2xl font-bold">
						{production.nama ?? "Produk"}
					</DrawerTitle>
					<DrawerDescription className="sr-only">
						Status produksi
					</DrawerDescription>
					<div className="my-6 rounded-2xl bg-card p-5 text-center">
						<p className="text-sm text-muted-foreground">Status saat ini</p>
						<p className="mt-1 text-2xl font-black">
							{production.tahapSekarang}
						</p>
					</div>
					<p
						id="tahap-produksi-label"
						className="mb-2 block text-sm font-semibold text-muted-foreground"
					>
						Pilih status
					</p>
					<Select
						value={selectedTahap}
						onValueChange={(value) => setSelectedTahap(value ?? "")}
					>
						<SelectTrigger
							aria-labelledby="tahap-produksi-label"
							className="mb-3 h-12 w-full rounded-2xl"
						>
							<SelectValue placeholder="Pilih status baru" />
						</SelectTrigger>
						<SelectContent>
							{productionSteps
								.filter((tahap) => tahap !== production.tahapSekarang)
								.map((tahap) => (
									<SelectItem key={tahap} value={tahap}>
										{tahap}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<Button
						className="w-full text-lg"
						disabled={!selectedTahap}
						onClick={() => setConfirming(true)}
					>
						UBAH STATUS
					</Button>
				</div>
			</DrawerContent>
			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent showCloseButton={!saving}>
					<DialogHeader>
						<DialogTitle>Ubah status produksi?</DialogTitle>
						<DialogDescription>
							Status akan berubah dari {production.tahapSekarang} ke{" "}
							{selectedTahap}.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose
							disabled={saving}
							render={<Button variant="secondary" />}
						>
							Batal
						</DialogClose>
						<Button disabled={saving} onClick={advance}>
							{saving ? "Memproses..." : "Ya, ubah status"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Drawer>
	);
}
