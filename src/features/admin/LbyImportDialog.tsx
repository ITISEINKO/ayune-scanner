"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LbyImportState } from "@/types/panelLocation";

const messages: Record<string, string> = {
	UNAUTHORIZED: "Sesi berakhir. Silakan login kembali.",
	ADMIN_REQUIRED: "Hanya ADMIN yang dapat mengimpor atau mengaktifkan model.",
	INVALID_LBY_LINK: "Gunakan link share LBY cadVisitor yang lengkap dan valid.",
	LINK_EXPIRED: "Link LBY sudah kedaluwarsa. Minta link share baru.",
	ORDER_MISMATCH:
		"Link ini berasal dari order LBY yang berbeda. Model aktif tidak diganti.",
	IMPORT_BUSY:
		"Import untuk order ini masih berjalan. Tunggu beberapa menit lalu buka kembali dialog.",
	IMPORT_CONFLICT:
		"Data aktif berubah. Tutup dan buka kembali dialog sebelum mencoba lagi.",
	MODEL_TOO_LARGE:
		"Model terlalu besar untuk import online. Gunakan proses import melalui CLI.",
	RATE_LIMITED:
		"LBY sedang membatasi permintaan. Coba lagi sebentar.",
	IMPORT_TIMEOUT:
		"Import melewati batas waktu. Model aktif tetap aman. Buka kembali dialog untuk memeriksa versi tersimpan sebelum mencoba lagi.",
	INVALID_PROJECT: "Model tersimpan tidak tersedia. Buka kembali dialog.",
};

export function LbyImportDialog() {
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState("");
	const [states, setStates] = useState<LbyImportState[]>([]);
	const [busy, setBusy] = useState<
		"loading" | "importing" | "activating" | null
	>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const pending = useRef(false);
	const run = async (
		action: "loading" | "importing" | "activating",
		state?: LbyImportState,
		revision?: string | null,
	) => {
		if (pending.current) return;
		pending.current = true;
		setBusy(action);
		setError("");
		setNotice("");
		try {
			const response = await fetch(
				"/api/admin/panel-locations",
				{
					method:
						action === "loading"
							? "GET"
							: action === "importing"
								? "POST"
								: "PATCH",
					...(action === "loading"
						? {}
						: {
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify(action === "importing"
										? { url }
										: {
												project: state?.projectKey,
												revision,
												expectedActiveRevision: state?.activeRevision ?? null,
											}),
							}),
					cache: "no-store",
					signal: AbortSignal.timeout(290000),
				},
			);
			let result;
			try {
				result = (await response.json()) as {
					ok?: boolean;
					error?: string;
					state?: LbyImportState;
					states?: LbyImportState[];
				};
			} catch {
				throw new Error(
					response.status === 504
						? messages.IMPORT_TIMEOUT
						: "Respons server tidak dapat dibaca. Buka kembali dialog untuk memeriksa versi tersimpan.",
				);
			}
			if (!response.ok || !result.ok || (!result.state && !result.states))
				throw new Error(
					messages[result.error ?? ""] ??
						"Import gagal. Model aktif tetap tersimpan; periksa link atau coba kembali.",
				);
			if (result.states) setStates(result.states);
			else if (result.state) {
				const updated = result.state;
				setStates((current) => [updated, ...current.filter((item) => item.projectKey !== updated.projectKey)]);
			}
			if (action === "importing") {
				setUrl("");
				setNotice(
					"Import berhasil disimpan. Periksa preview, lalu klik Aktifkan untuk memakai versi ini.",
				);
			}
			if (action === "activating")
				setNotice(
					"Model berhasil diaktifkan. Scan berikutnya memakai versi ini.",
				);
		} catch (cause) {
			setError(
				cause instanceof Error &&
					["TimeoutError", "AbortError"].includes(cause.name)
					? messages.IMPORT_TIMEOUT
					: cause instanceof Error
						? cause.message
						: "Permintaan gagal. Coba lagi.",
			);
		} finally {
			pending.current = false;
			setBusy(null);
		}
	};

	return (
		<>
			<Button
				variant="outline"
				className="min-h-10 w-full"
				onClick={() => {
					setOpen(true);
					void run("loading");
				}}
			>
				<Upload aria-hidden="true" />
				Import model LBY
			</Button>
			<Dialog
				open={open}
				onOpenChange={(next) => {
					if (!busy) {
						setOpen(next);
						if (!next) setUrl("");
					}
				}}
			>
				<DialogContent
					className="max-h-[85dvh] overflow-y-auto"
					showCloseButton={!busy}
				>
					<div className="pr-8">
						<DialogTitle className="text-lg font-bold">
							Import lokasi panel LBY
						</DialogTitle>
						<DialogDescription className="mt-2">
							Paste link LBY tanpa memilih project. Panel dicocokkan lewat board number / serial number persis. Periksa preview sebelum mengaktifkan model.
						</DialogDescription>
					</div>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void run("importing");
						}}
						className="space-y-3"
					>
						<label htmlFor="lby-share-url" className="text-sm font-semibold">
							Link share LBY
						</label>
						<Input
							id="lby-share-url"
							type="url"
							autoComplete="off"
							maxLength={20000}
							required
							disabled={Boolean(busy)}
							value={url}
							onChange={(event) => setUrl(event.target.value)}
							placeholder="https://www.lbyerp.com/#/cadVisitor?..."
						/>
						<p className="text-xs text-muted-foreground">
							LBY dapat memerlukan 12–20 detik atau lebih. Tunggu sampai
							selesai; batas proses download 4 menit. Link rahasia tidak
							disimpan.
						</p>
						<Button
							type="submit"
							disabled={Boolean(busy) || !url.trim()}
							className="w-full"
						>
							{busy === "importing" ? "Mengimpor…" : "Import model"}
						</Button>
					</form>
					{busy && (
						<p role="status" className="flex items-center gap-2 text-sm">
							<LoaderCircle
								aria-hidden="true"
								className="size-4 animate-spin"
							/>
							{busy === "loading"
								? "Memuat versi tersimpan…"
								: busy === "activating"
									? "Mengaktifkan model…"
									: "Mengambil dan memvalidasi data LBY. Tetap tunggu, proses masih berjalan…"}
						</p>
					)}
					{error && (
						<p
							role="alert"
							className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
						>
							{error}
						</p>
					)}
					{notice && (
						<p role="status" className="rounded-xl bg-accent/15 p-3 text-sm">
							{notice}
						</p>
					)}
					{!busy && states.length === 0 && <p className="text-sm text-muted-foreground">Belum ada model yang diimpor.</p>}
					{states.map((state) => (
						<section key={state.projectKey} aria-label={`Versi model ${state.projectKey}`} className="space-y-3">
							<h3 className="font-bold">Versi model</h3>
							{!state.activeRevision && (
								<p className="text-xs text-muted-foreground">
									{state.bundledVersion
										? `Model bawaan ${state.bundledVersion} masih aktif.`
										: "Belum ada model aktif untuk project ini."}
								</p>
							)}
							{state.bundledVersion && state.activeRevision && (
								<Button
									size="sm"
									variant="outline"
									disabled={Boolean(busy)}
									onClick={() => void run("activating", state, null)}
								>
									Gunakan model bawaan {state.bundledVersion}
								</Button>
							)}
							{state.versions.map((version) => (
								<article
									key={version.revision}
									className="rounded-xl border p-3"
								>
									<p className="font-semibold">{version.name}</p>
									<p className="mt-1 text-xs text-muted-foreground">Order {version.orderId} · Contoh serial {version.sampleBarcode}</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{version.panelCount} panel · {version.roomCount} ruang ·
										versi {version.version}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{new Date(version.importedAt).toLocaleString("id-ID", {
											timeZone: "Asia/Jakarta",
										})}
									</p>
									<div className="mt-3 flex gap-2">
										<Button
											nativeButton={false}
											render={
												<a
													href={`/panel-location?${new URLSearchParams({ project: state.projectKey, barcode: version.sampleBarcode, revision: version.revision })}`}
													target="_blank"
													rel="noopener noreferrer"
												/>
											}
											variant="outline"
											size="sm"
										>
											Preview
										</Button>
										<Button
											size="sm"
											disabled={
												Boolean(busy) ||
												state.activeRevision === version.revision
											}
											onClick={() => void run("activating", state, version.revision)}
										>
											{state.activeRevision === version.revision
												? "Aktif"
												: "Aktifkan"}
										</Button>
									</div>
								</article>
							))}
						</section>
					))}
				</DialogContent>
			</Dialog>
		</>
	);
}
