"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

export type ProductionItem = {
	taskId: string;
	nama: string | null;
	barcode: string;
	tahapSekarang: string;
	tahapBerikutnya: string | null;
	isQcStage: boolean;
	actions: { lanjut: boolean; qcPass: boolean };
};

type Props = { production: ProductionItem; onClose: () => void; onUpdated: () => void };

export function StatusChange({ production, onClose, onUpdated }: Props) {
	const [confirming, setConfirming] = useState(false);
	const [saving, setSaving] = useState(false);
	const canAdvance = Boolean(production.tahapBerikutnya && (production.actions.lanjut || production.actions.qcPass));

	const advance = async () => {
		setSaving(true);
		try {
			const form = new FormData();
			form.append("task_id", production.taskId);
			if (production.isQcStage) form.append("qc_pass", "true");
			const response = await fetch("/api/produksi/advance", { method: "POST", body: form });
			const data = await response.json() as { error?: string };
			if (!response.ok) throw new Error(data.error ?? "Status tidak dapat diperbarui.");
			setConfirming(false);
			onUpdated();
			toast.success("Status diperbarui.");
		} catch (error) {
			toast.error("Gagal memperbarui status", { description: error instanceof Error ? error.message : undefined });
		} finally {
			setSaving(false);
		}
	};

	return (
		<Drawer open onOpenChange={(open) => !open && onClose()} snapPoints={["22rem", 1]} showSwipeHandle>
			<DrawerContent className="rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="p-5 pb-8">
					<DrawerTitle className="text-2xl font-bold">{production.nama ?? "Produk"}</DrawerTitle>
					<DrawerDescription className="sr-only">Status produksi</DrawerDescription>
					<div className="my-6 rounded-2xl bg-card p-5 text-center">
						<p className="text-sm text-muted-foreground">Status saat ini</p>
						<p className="mt-1 text-2xl font-black">{production.tahapSekarang}</p>
					</div>
					{canAdvance && <Button className="w-full py-7 text-lg" onClick={() => setConfirming(true)}>LANJUT KE {production.tahapBerikutnya}</Button>}
					<Button className="mt-4 w-full" variant="secondary" onClick={onClose}>SCAN BARCODE LAIN</Button>
				</div>
			</DrawerContent>
			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent showCloseButton={!saving}>
					<DialogHeader>
						<DialogTitle>Lanjutkan produksi?</DialogTitle>
						<DialogDescription>Status akan berubah dari {production.tahapSekarang} ke {production.tahapBerikutnya}.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose disabled={saving} render={<Button variant="secondary" />}>Batal</DialogClose>
						<Button disabled={saving} onClick={advance}>{saving ? "Memproses..." : "Ya, lanjutkan"}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Drawer>
	);
}
