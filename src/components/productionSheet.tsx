"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, Send, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type ProductionItem = {
	taskId: string;
	nama: string | null;
	status: string | null;
	barcode: string;
	sku: string | null;
	progress: number | null;
	tahapSekarang: string;
	tahapBerikutnya: string | null;
	isQcStage: boolean;
	qcResult: string | null;
	kendalaAktif: string | null;
	bisaLanjut: boolean;
	alasanTidakBisaLanjut: string | null;
	kendala: Array<{ id: string; nama: string | null; status: string | null; jenis: string | null; tahap: string | null; detail: string | null; pic: string | null; dibuat: number | null; selesai: number | null }>;
	actions: { lanjut: boolean; qcPass: boolean; qcFail: boolean; laporKendala: boolean };
};

type Props = { production: ProductionItem; onClose: () => void; onUpdated: () => void };
type KendalaOption = { id: string; name: string };

const age = (timestamp: number | null) => {
	if (!timestamp) return "";
	const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
	return minutes < 60 ? `${minutes || 1} menit lalu` : `${Math.floor(minutes / 60)} jam lalu`;
};

export function ProductionSheet({ production: item, onClose, onUpdated }: Props) {
	const production = { ...item, kendala: item.kendala ?? [], actions: item.actions ?? { lanjut: false, qcPass: false, qcFail: false, laporKendala: false } };
	const [advancePhoto, setAdvancePhoto] = useState<File | null>(null);
	const [reporting, setReporting] = useState<"qc" | "manual" | null>(null);
	const [options, setOptions] = useState<KendalaOption[]>([]);
	const [jenisId, setJenisId] = useState("");
	const [detail, setDetail] = useState("");
	const [photos, setPhotos] = useState<File[]>([]);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const previews = useMemo(() => photos.map((photo) => ({ name: photo.name, url: URL.createObjectURL(photo) })), [photos]);
	useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
	useEffect(() => {
		if (!reporting || options.length) return;
		fetch("/api/produksi/kendala-options").then(async (response) => {
			const result = await response.json() as { ok?: boolean; data?: KendalaOption[] };
			if (response.ok && result.ok) setOptions(result.data ?? []);
		});
	}, [reporting, options.length]);
	useEffect(() => {
		if (reporting === "qc") setJenisId(options.find((option) => option.name === "Quality Problem")?.id ?? "");
	}, [reporting, options]);

	const openKendala = production.kendala.find((item) => item.status !== "resolved");
	const submitAdvance = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!advancePhoto) return;
		setSaving(true); setError("");
		try {
			const form = new FormData();
			form.append("task_id", production.taskId);
			form.append("attachment", advancePhoto, advancePhoto.name);
			if (production.isQcStage) form.append("qc_pass", "true");
			const response = await fetch("/api/produksi/advance", { method: "POST", body: form });
			const data = await response.json() as { error?: string };
			if (!response.ok) throw new Error(data.error ?? "Foto tidak dapat dikirim.");
			setAdvancePhoto(null); onUpdated(); toast.success(production.isQcStage ? "QC Pass, produksi dilanjutkan" : "Produksi dilanjutkan");
		} catch (caught) { setError(caught instanceof Error ? caught.message : "Foto tidak dapat dikirim."); }
		finally { setSaving(false); }
	};
	const submitKendala = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!jenisId || detail.trim().length < 10 || !photos.length) return;
		setSaving(true); setError("");
		try {
			const form = new FormData();
			form.append("jenisId", jenisId);
			form.append("detail", detail.trim());
			if (reporting === "qc") form.append("qc_fail", "true");
			photos.forEach((photo) => form.append("photos[]", photo, photo.name));
			const response = await fetch(`/api/produksi/${encodeURIComponent(production.barcode)}/kendala`, { method: "POST", body: form });
			const data = await response.json() as { error?: string };
			if (!response.ok) throw new Error(data.error ?? "Kendala tidak dapat dikirim.");
			setReporting(null); setDetail(""); setPhotos([]); onUpdated(); toast.success("Kendala tercatat, produksi ditahan");
		} catch (caught) { setError(caught instanceof Error ? caught.message : "Kendala tidak dapat dikirim."); }
		finally { setSaving(false); }
	};
	const startReport = (mode: "qc" | "manual") => { setError(""); setReporting(mode); };

	return (
		<Drawer open onOpenChange={(open) => !open && onClose()} snapPoints={["40rem", 1]} showSwipeHandle>
			<DrawerContent className="max-h-[calc(100dvh-1rem)] rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="flex-1 overflow-y-auto p-5 pb-8">
					<p className="text-sm font-bold text-primary">PRODUKSI</p>
					<DrawerTitle className="text-2xl font-bold">{production.nama ?? production.barcode}</DrawerTitle>
					<DrawerDescription className="mt-1">{production.barcode} · {production.sku ?? "-"}</DrawerDescription>
					<div className="my-5 rounded-2xl bg-card p-5 text-center"><p className="text-sm text-muted-foreground">Tahap Produksi</p><p className="mt-1 text-2xl font-black text-card-foreground">{production.tahapSekarang}</p></div>
					{openKendala && <Alert variant="destructive" className="mb-4"><TriangleAlert /><AlertTitle>⚠️ {openKendala.jenis ?? "Kendala"} · {age(openKendala.dibuat)}</AlertTitle><AlertDescription>{openKendala.detail}</AlertDescription></Alert>}
					<dl className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">Progress</dt><dd className="mt-1 text-lg font-bold">{production.progress === null ? "-" : `${production.progress}%`}</dd></div><div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">QC Result</dt><dd className="mt-1 text-lg font-bold">{production.qcResult ?? "-"}</dd></div></dl>
					{!reporting && (production.actions.lanjut || production.actions.qcPass) && <form className="mt-5 space-y-3" onSubmit={submitAdvance}><label className="block text-sm font-semibold">Foto bukti<Input key={production.tahapSekarang} className="mt-2" type="file" accept="image/*" capture="environment" onChange={(event) => setAdvancePhoto(event.target.files?.[0] ?? null)} required /></label><Button type="submit" className="w-full py-7 text-lg" disabled={!advancePhoto || saving}><Send className="mr-2 size-5" />{saving ? "Mengirim..." : production.isQcStage ? "PASS & LANJUT" : "KIRIM FOTO & LANJUT"}</Button></form>}
					{!reporting && production.actions.qcFail && <Button className="mt-3 w-full py-7 text-lg" variant="destructive" onClick={() => startReport("qc")}>FAIL & LAPOR KENDALA</Button>}
					{!reporting && production.actions.laporKendala && <Button className="mt-3 w-full py-7 text-lg" variant="secondary" onClick={() => startReport("manual")}>LAPOR KENDALA</Button>}
					{production.alasanTidakBisaLanjut && !reporting && <p className="mt-3 text-center text-sm font-medium text-destructive">{production.alasanTidakBisaLanjut}</p>}
					{reporting && <form className="mt-5 space-y-4" onSubmit={submitKendala}><div><p className="text-sm font-semibold">Jenis Kendala</p><div className="mt-2 grid grid-cols-2 gap-2">{options.map((option) => <Button key={option.id} type="button" variant={jenisId === option.id ? "default" : "secondary"} className="h-auto min-h-12 whitespace-normal" onClick={() => setJenisId(option.id)}>{option.name.replace(" Problem", "")}</Button>)}</div></div><label className="block text-sm font-semibold">Foto (1–3)<Input className="mt-2" type="file" accept="image/*" capture="environment" multiple onChange={(event) => setPhotos(Array.from(event.target.files ?? []).slice(0, 3))} required /></label>{previews.length > 0 && <div className="grid grid-cols-3 gap-2">{previews.map((preview) => <img key={preview.url} src={preview.url} alt={preview.name} className="aspect-square rounded-lg object-cover" />)}</div>}<label className="block text-sm font-semibold">Detail<textarea className="mt-2 min-h-24 w-full rounded-xl border bg-background p-3" value={detail} onChange={(event) => setDetail(event.target.value)} minLength={10} required /></label><div className="flex flex-wrap gap-2">{["Stok kurang", "Retak", "Ukuran salah", "Mesin mati"].map((chip) => <Button key={chip} type="button" size="sm" variant="secondary" onClick={() => setDetail(chip)}>{chip}</Button>)}</div><Button type="submit" className="w-full py-7 text-lg" disabled={!jenisId || detail.trim().length < 10 || !photos.length || saving}><Camera className="mr-2 size-5" />{saving ? "Mengirim..." : "KIRIM KENDALA"}</Button><Button type="button" className="w-full" variant="ghost" onClick={() => setReporting(null)}>Batal</Button></form>}
					{production.kendala.filter((item) => item.status === "resolved").length > 0 && <details className="mt-5 rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Riwayat</summary>{production.kendala.filter((item) => item.status === "resolved").map((item) => <p key={item.id} className="mt-3 text-sm text-muted-foreground">{item.jenis} · {item.detail}</p>)}</details>}
					{error && <Alert variant="destructive" className="mt-4"><AlertTitle>Gagal</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
					<Button className="mt-5 w-full text-base" variant="secondary" onClick={onClose}>SCAN BARCODE LAIN</Button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
