"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Trial3DImportPage() {
	const [url, setUrl] = useState("");
	const [search, setSearch] = useState("");
	const [models, setModels] = useState<{ id: string; name: string; rooms: number }[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	async function load() {
		const response = await fetch("/api/admin/trial-3d-import", { cache: "no-store" });
		if (!response.ok) throw new Error("Daftar model tidak dapat dimuat.");
		setModels((await response.json()).models);
	}
	useEffect(() => { load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy) return;
		setBusy(true); setMessage("");
		try {
			const response = await fetch("/api/admin/trial-3d-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error);
			setUrl("");
			setMessage("Model berhasil diimport dan tersedia di panel viewer.");
			try { await load(); } catch { setMessage("Model berhasil diimport, tetapi daftar gagal dimuat. Muat ulang halaman."); }
		} catch (error) { setMessage(error instanceof Error ? error.message : "Import gagal."); }
		finally { setBusy(false); }
	}
	const filtered = models.filter((model) => model.name.toLowerCase().includes(search.trim().toLowerCase()));
	return <main className="mx-auto min-h-dvh max-w-lg bg-background pb-28">
		<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-8 text-accent-foreground">
			<img src="/ayune-14.svg" alt="" aria-hidden="true" className="pointer-events-none absolute -top-20 -right-16 size-70 opacity-10" />
			<div className="relative"><p className="text-md text-muted-foreground/80">Admin</p><h1 className="text-2xl font-extrabold tracking-tight">Model LBY</h1><p className="mt-2 text-sm text-muted-foreground">Import model untuk panel viewer.</p></div>
		</header>
		<div className="space-y-6 px-4 pt-5">
			<form onSubmit={submit} className="space-y-4 rounded-[1.35rem] border border-border/40 bg-card p-4 shadow-sm">
				<h2 className="font-bold">Import model baru</h2>
				<div className="space-y-2"><label htmlFor="trial-lby-url" className="text-sm font-medium">Link share LBY</label><Input id="trial-lby-url" type="url" required maxLength={20000} value={url} onChange={(event) => setUrl(event.target.value)} disabled={busy} placeholder="https://www.lbyerp.com/#/cadVisitor?..." className="h-11 rounded-xl bg-background" /></div>
				<p className="text-xs text-muted-foreground">Pastikan link berasal dari model atau order LBY yang benar. Model langsung tersedia di panel viewer setelah import.</p>
				<Button type="submit" disabled={busy || !url.trim()} className="w-full rounded-xl">{busy ? <LoaderCircle className="animate-spin" /> : <Upload />} {busy ? "Mengimport model..." : "Import model"}</Button>
			</form>
			{message && <p role="status" className="text-sm">{message}</p>}
			<section className="space-y-3" aria-busy={loading}><div className="flex items-center justify-between"><h2 className="font-bold">Model tersimpan</h2><span className="text-xs text-muted-foreground">{filtered.length} model</span></div>
				<div className="relative"><Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label="Cari model tersimpan" placeholder="Cari nama model..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl pl-9" /></div>
				{loading ? <p role="status" className="text-sm text-muted-foreground">Memuat model...</p> : filtered.length ? filtered.map((model) => <Link key={model.id} href={`/panel-viewer/${encodeURIComponent(model.id)}`} className="block rounded-2xl border bg-card p-4 hover:bg-muted/40"><h3 className="text-sm font-bold">{model.name}</h3><p className="mt-1 text-xs text-muted-foreground">{model.rooms} ruang · Buka viewer</p></Link>) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Tidak ada model yang ditemukan.</p>}
			</section>
		</div>
	</main>;
}
