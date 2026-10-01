"use client";

import { type FormEvent, useState } from "react";
import { Send, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

export type ProductionItem = {
	task_id: string;
	barcode: string;
	step: string | null;
	progress: number | null;
	qc_result: string | null;
	productType: string | null;
	bisaLanjut: boolean;
	kendala: Array<{
		id: string;
		nama: string | null;
		status: string | null;
		jenis: string | null;
		tahap: string | null;
		detail: string | null;
		dibuat: number | null;
		selesai: number | null;
	}>;
	last_scan: unknown;
};

type Props = {
	production: ProductionItem;
	onClose: () => void;
	onAdvanced: (next: string) => void;
};

export function ProductionSheet({ production, onClose, onAdvanced }: Props) {
	const [file, setFile] = useState<File | null>(null);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const canAdvance = production.bisaLanjut && Boolean(production.step && production.step !== "Pengiriman");

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!file) return;
		setSaving(true);
		setError("");
		try {
			const form = new FormData();
			form.append("task_id", production.task_id);
			form.append("attachment", file, file.name);
			const response = await fetch("/api/produksi/advance", { method: "POST", body: form });
			const data = (await response.json()) as { to?: string; error?: string };
			if (!response.ok || !data.to) throw new Error(data.error ?? "Foto tidak dapat dikirim.");
			setFile(null);
			onAdvanced(data.to);
		} catch (error) {
			setError(error instanceof Error ? error.message : "Foto tidak dapat dikirim.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Drawer open onOpenChange={(open) => !open && onClose()} snapPoints={["32rem", 1]} showSwipeHandle>
			<DrawerContent className="max-h-[calc(100dvh-1rem)] rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="flex-1 overflow-y-auto p-5 pb-8">
					<p className="text-sm font-bold text-primary">PRODUKSI</p>
					<DrawerTitle className="text-2xl font-bold">{production.barcode}</DrawerTitle>
					<DrawerDescription className="sr-only">Detail produksi</DrawerDescription>
					<div className="my-5 rounded-2xl bg-card p-5 text-center">
						<p className="text-sm text-muted-foreground">Tahap Produksi</p>
						<p className="mt-1 text-2xl font-black text-card-foreground">{production.step ?? "Belum ditentukan"}</p>
					</div>
					<dl className="grid grid-cols-2 gap-3 text-sm">
						<div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">Progress</dt><dd className="mt-1 text-lg font-bold">{production.progress === null ? "-" : `${production.progress}%`}</dd></div>
						<div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">QC Result</dt><dd className="mt-1 text-lg font-bold">{production.qc_result ?? "-"}</dd></div>
					</dl>
					{production.kendala.map((kendala) => (
						<Alert key={kendala.id} variant="destructive" className="mt-3">
							<TriangleAlert />
							<AlertTitle>{kendala.nama ?? "Kendala produksi"}{kendala.status && ` (${kendala.status})`}</AlertTitle>
							<AlertDescription>{[kendala.jenis, kendala.tahap, kendala.detail].filter(Boolean).join(" • ")}</AlertDescription>
						</Alert>
					))}
					{canAdvance && (
						<form className="mt-5 space-y-3" onSubmit={submit}>
							<label className="block text-sm font-semibold">
								Foto bukti
								<Input key={production.step} className="mt-2" type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
							</label>
							{error && <Alert variant="destructive"><AlertTitle>Gagal melanjutkan</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
							<Button type="submit" className="w-full text-base" disabled={!file || saving}>
								<Send className="mr-2 size-5" />
								{saving ? "Mengirim..." : "Kirim foto & lanjutkan"}
							</Button>
						</form>
					)}
					<Button className="mt-5 w-full text-base" variant="secondary" onClick={onClose}>SCAN BARCODE LAIN</Button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
