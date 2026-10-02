"use client";

import { useState } from "react";
import { toast } from "sonner";
import StagePicker from "@/components/stagePicker";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import { TAHAP_FLOW } from "@/lib/produksi";
import { Badge } from "@/components/ui/badge";

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
	const [saving, setSaving] = useState(false);
	const [selectedTahap, setSelectedTahap] = useState("");
	const currentStage = TAHAP_FLOW.findIndex(
		(tahap) => tahap.name === production.tahapSekarang,
	);

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
			snapPoints={["28rem", 1]}
			showSwipeHandle
		>
			<DrawerContent className="[--drawer-inset:0px]! rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="flex-1 overflow-y-auto p-5 pb-8">
					<Badge className="mb-3">Barcode: {production.barcode}</Badge>
					<DrawerTitle className="text-2xl font-bold">
						{production.nama ?? "Produk"}
					</DrawerTitle>
					<DrawerDescription className="mt-1">
						Pastikan produk sudah sesuai, lalu pilih status baru.
					</DrawerDescription>
					<div className="my-6 rounded-2xl bg-card p-5 text-center">
						<p className="text-sm text-muted-foreground">Status saat ini</p>
						<p className="mt-1 text-2xl font-black">
							{production.tahapSekarang}
						</p>
					</div>
					<StagePicker
						currentStage={currentStage}
						selectedStage={selectedTahap}
						onStageChange={setSelectedTahap}
					/>
					{selectedTahap && (
						<div
							role="alert"
							className="animate-in fade-in-0 slide-in-from-top-2 mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 duration-200"
						>
							<p className="font-bold">Ubah status produksi?</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{production.tahapSekarang} → {selectedTahap}
							</p>
							<div className="mt-4 flex gap-2">
								<Button
									type="button"
									variant="secondary"
									className="flex-1"
									disabled={saving}
									onClick={() => setSelectedTahap("")}
								>
									Batal
								</Button>
								<Button
									type="button"
									className="flex-1"
									disabled={saving}
									onClick={advance}
								>
									{saving ? "Memproses..." : "Ya, ubah status"}
								</Button>
							</div>
						</div>
					)}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
