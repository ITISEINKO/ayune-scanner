"use client";

import { useEffect, useRef, useState } from "react";
import {
	Check,
	Circle,
	ClipboardPaste,
	Clock3,
	LoaderCircle,
	Search,
	Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PanelLocationViewer } from "./PanelLocationViewer";
import { loadLbyPreview } from "./loadLbyPreview";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import type {
	PanelLocationView,
	LbyImportResponse,
	LbyImportStage,
	LbyImportState,
} from "@/types/panelLocation";

const importSteps: { stage: LbyImportStage; label: string }[] = [
	{ stage: "downloading", label: "Mengunduh model" },
	{ stage: "panels", label: "Membaca panel" },
	{ stage: "rooms", label: "Menyusun ruang" },
	{ stage: "saving", label: "Menyimpan versi" },
];

const messages: Record<string, string> = {
	UNAUTHORIZED: "Sesi berakhir. Silakan login kembali.",
	LBY_IMPORT_REQUIRED: "Akses model LBY tidak tersedia. Hubungi admin.",
	INVALID_LBY_LINK: "Gunakan link share LBY cadVisitor yang lengkap dan valid.",
	LINK_EXPIRED: "Link LBY sudah kedaluwarsa. Minta link share baru.",
	LBY_NO_PANEL_DATA:
		"LBY mengembalikan daftar panel/serial kosong untuk order ini. Model CAD saja belum cukup untuk pencarian lokasi panel. Periksa data panel/serial di LBY, lalu impor ulang. Model aktif tidak diganti.",
	ORDER_MISMATCH:
		"Link ini berasal dari order LBY yang berbeda. Model aktif tidak diganti.",
	IMPORT_BUSY:
		"Import untuk order ini masih berjalan. Tunggu beberapa menit lalu muat ulang halaman.",
	IMPORT_CONFLICT:
		"Data aktif berubah. Muat ulang halaman sebelum mencoba lagi.",
	MODEL_TOO_LARGE:
		"Model terlalu besar untuk import online. Gunakan proses import melalui CLI.",
	RATE_LIMITED: "LBY sedang membatasi permintaan. Coba lagi sebentar.",
	IMPORT_TIMEOUT:
		"Import melewati batas waktu. Model aktif tetap aman. Muat ulang halaman untuk memeriksa versi tersimpan sebelum mencoba lagi.",
	INVALID_PROJECT: "Model tersimpan tidak tersedia. Muat ulang halaman.",
};

export function LbyImportPage({
	workspace = "Drafter",
}: {
	workspace?: "Admin" | "Drafter";
}) {
	const [url, setUrl] = useState("");
	const [states, setStates] = useState<LbyImportState[]>([]);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	useEffect(() => {
		const timeout = window.setTimeout(
			() => setDebouncedSearch(search.trim().toLowerCase()),
			250,
		);
		return () => window.clearTimeout(timeout);
	}, [search]);
	const savedModels = states.filter((state) => state.versions.length);
	const filteredModels = savedModels.filter(
		(state) =>
			state.projectKey.toLowerCase().includes(debouncedSearch) ||
			state.versions.some((version) =>
				version.name.toLowerCase().includes(debouncedSearch),
			),
	);
	const [busy, setBusy] = useState<
		"loading" | "importing" | "activating" | null
	>("loading");
	const [importTarget, setImportTarget] = useState<LbyImportState | null>(null);
	const [review, setReview] = useState<{
		state: LbyImportState;
		revision: string | null;
	} | null>(null);
	const [preview, setPreview] = useState<{
		state: LbyImportState;
		revision: string | null;
		location?: PanelLocationView;
		error?: string;
	} | null>(null);
	const [checked, setChecked] = useState(false);
	const previewRequest = useRef(0);
	const previewSection = useRef<HTMLElement>(null);
	const previewTrigger = useRef<HTMLElement | null>(null);
	const openPreview = async (state: LbyImportState, revision: string | null) => {
		const request = ++previewRequest.current;
		previewTrigger.current = document.activeElement as HTMLElement;
		setChecked(false);
		setReview(null);
		setPreview({ state, revision });
		try {
			const version = state.versions.find((item) => item.revision === revision);
			const location = await loadLbyPreview(state.projectKey, version?.sampleBarcode ?? "", revision);
			if (request === previewRequest.current) setPreview({ state, revision, location });
		} catch {
			if (request === previewRequest.current)
				setPreview({ state, revision, error: "Preview gagal dimuat. Coba lagi; model aktif tetap digunakan." });
		}
	};
	const closePreview = () => {
		++previewRequest.current;
		setPreview(null);
		setChecked(false);
		requestAnimationFrame(() => previewTrigger.current?.focus());
	};
	useEffect(() => {
		if (preview) previewSection.current?.focus();
	}, [preview?.state.projectKey, preview?.revision]);
	const urlInput = useRef<HTMLInputElement>(null);
	const pending = useRef(false);
	const importController = useRef<AbortController | null>(null);
	const [importStage, setImportStage] = useState<LbyImportStage>("downloading");
	const [elapsed, setElapsed] = useState(0);
	const stepIndex = importSteps.findIndex((step) => step.stage === importStage);
	useEffect(() => {
		if (busy !== "importing") return;
		const started = Date.now();
		const timer = setInterval(
			() => setElapsed(Math.floor((Date.now() - started) / 1000)),
			1000,
		);
		return () => clearInterval(timer);
	}, [busy]);
	const run = async (
		action: "loading" | "importing" | "activating",
		state?: LbyImportState,
		revision?: string | null,
	) => {
		if (pending.current) return;
		pending.current = true;
		const controller = action === "importing" ? new AbortController() : null;
		if (controller) {
			importController.current = controller;
			setImportStage("downloading");
			setElapsed(0);
		}
		setBusy(action);
		try {
			const response = await fetch("/api/admin/panel-locations", {
				method:
					action === "loading"
						? "GET"
						: action === "importing"
							? "POST"
							: "PATCH",
				...(action === "loading"
					? {}
					: {
						headers: {
							"Content-Type": "application/json",
							...(action === "importing"
								? { Accept: "application/x-ndjson" }
								: {}),
						},
						body: JSON.stringify(
							action === "importing"
								? {
									url,
									...(importTarget
										? { project: importTarget.projectKey }
										: {}),
								}
								: {
									project: state?.projectKey,
									revision,
									expectedActiveRevision: state?.activeRevision ?? null,
								},
						),
					}),
				cache: "no-store",
				signal: controller
					? AbortSignal.any([controller.signal, AbortSignal.timeout(290000)])
					: AbortSignal.timeout(290000),
			});
			let result: LbyImportResponse | undefined;
			try {
				if (
					response.headers
						.get("content-type")
						?.includes("application/x-ndjson") &&
					response.body
				) {
					const reader = response.body
						.pipeThrough(new TextDecoderStream())
						.getReader();
					let buffer = "";
					try {
						while (true) {
							const { done, value } = await reader.read();
							buffer += value ?? "";
							const lines = buffer.split("\n");
							buffer = lines.pop() ?? "";
							if (done && buffer.trim()) lines.push(buffer);
							for (const line of lines.filter((line) => line.trim())) {
								const event = JSON.parse(line) as LbyImportResponse;
								if (
									event.stage &&
									importSteps.some((step) => step.stage === event.stage)
								)
									setImportStage(event.stage);
								else if (typeof event.ok === "boolean") result = event;
							}
							if (done) break;
						}
					} finally {
						reader.releaseLock();
					}
				} else result = (await response.json()) as LbyImportResponse;
				if (!result) throw new Error("Incomplete import response");
			} catch (cause) {
				if (
					controller?.signal.aborted ||
					(cause instanceof Error &&
						["AbortError", "TimeoutError"].includes(cause.name))
				)
					throw cause;
				throw new Error(
					response.status === 504
						? messages.IMPORT_TIMEOUT
						: "Respons server tidak dapat dibaca. Muat ulang halaman untuk memeriksa versi tersimpan.",
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
				setStates((current) => [
					updated,
					...current.filter((item) => item.projectKey !== updated.projectKey),
				]);
			}
			if (action === "importing") {
				setUrl("");
				setImportTarget(null);
				if (result.state && result.candidate)
					void openPreview(result.state, result.candidate.revision);
				toast.success(
					"Import berhasil disimpan. Periksa model 3D sebelum mengaktifkannya.",
				);
			}
			if (action === "activating") {
				setReview(null);
				closePreview();
				toast.success(
					"Model berhasil diaktifkan. Scan berikutnya memakai versi ini.",
				);
			}
		} catch (cause) {
			if (controller?.signal.aborted) {
				toast.info("Import dibatalkan. Model aktif tetap aman.");
				return;
			}
			toast.error(
				cause instanceof Error &&
					["TimeoutError", "AbortError"].includes(cause.name)
					? messages.IMPORT_TIMEOUT
					: cause instanceof Error
						? cause.message
						: "Permintaan gagal. Coba lagi.",
				{ duration: 10000 },
			);
		} finally {
			pending.current = false;
			setBusy(null);
			if (controller) importController.current = null;
		}
	};

	useEffect(() => {
		void run("loading");
		return () => importController.current?.abort();
	}, []);
	const pasteLink = async () => {
		try {
			const pasted = (await navigator.clipboard.readText()).trim();
			if (pasted.length > 20000) {
				toast.error(
					"Link terlalu panjang. Gunakan link share LBY yang lengkap dan valid.",
				);
				return;
			}
			setUrl(pasted);
		} catch {
			toast.error(
				"Clipboard tidak dapat dibaca. Tempel link langsung di kolom Link share LBY.",
			);
		}
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-28 md:max-w-6xl">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-8 text-accent-foreground">
				<img
					src="/ayune-14.svg"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -top-20 -right-16 z-0 size-70 opacity-10"
				/>
				<div className="relative z-10">
					<p className="text-md text-muted-foreground/80">{workspace}</p>
					<h1 className="text-2xl font-extrabold tracking-tight">Model LBY</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Kelola model untuk pencarian lokasi panel.
					</p>
					<ol
						aria-label="Cara menggunakan model"
						className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold"
					>
						<li>1. Import link</li>
						<li>2. Periksa preview</li>
						<li>3. Gunakan model</li>
					</ol>
				</div>
			</header>
			<div hidden={Boolean(preview)} className="space-y-6 px-4 pt-5 md:mx-auto md:max-w-2xl">
				{busy === "importing" ? (
					<section
						aria-labelledby="import-title"
						className="rounded-[1.35rem] border border-border/40 bg-card p-4 shadow-sm"
					>
						<h2
							id="import-title"
							className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
						>
							<span
								aria-hidden="true"
								className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
							>
								2
							</span>
							Sedang mengimport
						</h2>
						<p role="status" className="sr-only">
							{importSteps[stepIndex].label}
						</p>
						<ol className="my-5 space-y-4">
							{importSteps.map((step, index) => (
								<li
									key={step.stage}
									aria-current={index === stepIndex ? "step" : undefined}
									className={`flex items-center gap-3 text-sm ${index === stepIndex ? "font-medium text-foreground" : "text-muted-foreground"}`}
								>
									{index < stepIndex ? (
										<Check
											aria-hidden="true"
											className="size-6 text-[#22c55e]"
										/>
									) : index === stepIndex ? (
										<LoaderCircle
											aria-hidden="true"
											className="size-6 motion-safe:animate-spin text-[#22c55e]"
										/>
									) : (
										<Circle aria-hidden="true" className="size-6 text-border" />
									)}
									{step.label}
								</li>
							))}
						</ol>
						<Progress
							aria-label="Progres tahapan import"
							value={stepIndex}
							max={importSteps.length}
							className="gap-0 **:data-[slot=progress-track]:h-1.5 **:data-[slot=progress-indicator]:min-w-[15%] **:data-[slot=progress-indicator]:bg-[#22c55e]"
						/>
						<div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
							<span className="tabular-nums">{elapsed} dtk</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={importStage === "saving"}
								onClick={() => importController.current?.abort()}
								className="h-8 px-1 text-xs font-semibold text-destructive hover:text-destructive"
							>
								Batalkan
							</Button>
						</div>
					</section>
				) : (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void run("importing");
						}}
						className="space-y-4 rounded-[1.35rem] border border-border/40 bg-card p-4 shadow-sm"
					>
						<h2 className="font-bold">
							{importTarget ? "Perbarui model" : "Import model baru"}
						</h2>
						<div className="space-y-2">
							{importTarget && (
								<div className="flex items-start justify-between gap-2 text-sm">
									<p>
										Update model:{" "}
										<strong>
											{importTarget.versions[0]?.name ??
												importTarget.projectKey}
										</strong>
									</p>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={Boolean(busy)}
										onClick={() => {
											setImportTarget(null);
											setUrl("");
										}}
									>
										Batal update
									</Button>
								</div>
							)}
							<label
								htmlFor="lby-share-url"
								className="text-sm font-medium"
							>
								Link share LBY
							</label>
							<div className="relative">
								<Input
									ref={urlInput}
									id="lby-share-url"
									aria-label="Link share LBY"
									aria-describedby="lby-import-help"
									type="url"
									autoComplete="off"
									maxLength={20000}
									required
									disabled={Boolean(busy)}
									value={url}
									onChange={(event) => setUrl(event.target.value)}
									placeholder="https://www.lbyerp.com/#/cadVisitor?..."
									className="h-11 rounded-xl bg-background pr-12 text-sm"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Tempel"
									title="Tempel link"
									disabled={Boolean(busy)}
									onClick={() => void pasteLink()}
									className="absolute top-1/2 right-1 -translate-y-1/2"
								>
									<ClipboardPaste aria-hidden="true" className="size-4" />
								</Button>
							</div>
						</div>
						<p id="lby-import-help" className="text-xs text-muted-foreground">
							Pastikan link berasal dari model/order LBY yang benar. Setelah import,
							cocokkan bentuk model dengan tampilan di LBY sebelum digunakan.
						</p>
						<Button
							type="submit"
							disabled={Boolean(busy) || !url.trim()}
							className="w-full rounded-xl"
						>
							<Upload aria-hidden="true" />
							{importTarget ? "Import pembaruan" : "Import model"}
						</Button>
					</form>
				)}
				<section
					aria-labelledby="saved-models"
					aria-busy={busy === "loading"}
					className="space-y-3"
				>
					<div className="flex items-center justify-between gap-2">
						<h2 id="saved-models" className="font-bold">
							Model tersimpan
						</h2>
						{busy === "loading" ? (
							<Skeleton aria-hidden="true" className="h-4 w-24" />
						) : (
							<p className="text-xs text-muted-foreground">
								{debouncedSearch
									? `${filteredModels.length} dari ${savedModels.length}`
									: savedModels.length} model
							</p>
						)}
					</div>
					<div className="relative">
						<Search
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							type="search"
							aria-label="Cari model tersimpan"
							placeholder="Cari nama model atau project..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="h-11 rounded-xl bg-background pl-9 text-sm"
						/>
					</div>
					{busy === "loading" && (
						<div
							role="status"
							aria-label="Memuat model tersimpan"
							className="space-y-3"
						>
							<span className="sr-only">Memuat model tersimpan…</span>
							{[0, 1].map((index) => (
								<div
									key={index}
									aria-hidden="true"
									className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4"
								>
									<Skeleton className="size-2 shrink-0 rounded-full" />
									<div className="flex-1 space-y-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								</div>
							))}
						</div>
					)}
					{!busy && !filteredModels.length && (
						<p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
							{savedModels.length
								? "Tidak ada model yang cocok dengan pencarian."
								: "Belum ada model. Tempel link LBY di atas untuk mulai import."}
						</p>
					)}
					{filteredModels.map((state) => {
						const latest = state.versions[0];
						if (!latest) return null;
						const active = state.versions.find(
							(version) => version.revision === state.activeRevision,
						);
						const candidate =
							latest.revision !== state.activeRevision ? latest : null;
						return (
							<article
								key={state.projectKey}
								aria-label={latest.name}
								className="overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground"
							>

								<details className="group/model">
									<summary className="flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
										<span aria-label={active || state.bundledVersion ? "Sedang digunakan" : "Belum digunakan"}
											className={"size-2 shrink-0 rounded-full " + (active || state.bundledVersion ? "bg-primary" : "bg-muted-foreground")} />
										<div className="min-w-0 flex-1">
											<h3 className="truncate text-sm font-bold" title={latest.name}>{latest.name}</h3>
											<p className="mt-0.5 truncate text-xs text-muted-foreground">
												{latest.panelCount} panel &middot; {latest.roomCount} ruang &middot; {new Date(latest.importedAt).toLocaleString("id-ID", {
													timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
												})}{candidate && " - Perlu diperiksa"}
											</p>
										</div>
										<span aria-hidden="true" className="text-xs text-muted-foreground transition-transform group-open/model:rotate-180">&#9662;</span>
									</summary>
									<div className="space-y-4 border-t border-border/50 p-4">
										<div className="grid grid-cols-2 gap-2">
											<Button type="button" variant="outline" disabled={Boolean(busy)} className="h-11 rounded-xl"
												onClick={() => void openPreview(state, latest.revision)}>Preview 3D</Button>
											<Button type="button" variant="outline" disabled={Boolean(busy)} className="h-11 rounded-xl"
												onClick={() => {
													setImportTarget(state); setUrl(state.sourceUrl ?? "");
													urlInput.current?.focus(); urlInput.current?.scrollIntoView({ block: "center", behavior: "smooth" });
												}}>Update model</Button>
										</div>
										{state.sourceUrl && <Button type="button" variant="ghost" size="sm" className="mx-auto flex h-auto text-xs text-muted-foreground"
											onClick={async () => {
												try { await navigator.clipboard.writeText(state.sourceUrl!); toast.success("Link LBY disalin."); }
												catch { toast.error("Link tidak dapat disalin. Izinkan akses clipboard lalu coba lagi."); }
											}}>Salin link LBY</Button>}
										<section aria-label="Riwayat versi">
											<h4 className="mb-1 text-xs font-semibold">Riwayat versi</h4>
											{state.versions.map((version) => (
												<div key={version.revision} className="flex items-center justify-between gap-3 border-t border-dashed border-border/60 py-2 text-xs">
													<p className="min-w-0">V{version.versionNumber} &middot; {new Date(version.importedAt).toLocaleString("id-ID", {
														timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
													})} &middot; {version.panelCount} panel</p>
													{version.revision === state.activeRevision
														? <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">AKTIF</span>
														: <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 rounded-xl text-xs" disabled={Boolean(busy)}
															onClick={() => void openPreview(state, version.revision)}>Aktifkan<span className="sr-only"> V{version.versionNumber}</span></Button>}
												</div>
											))}
											{state.bundledVersion && <div className="flex items-center justify-between gap-3 border-t border-dashed border-border/60 py-2 text-xs">
												<p>V1 &middot; Model bawaan</p>
												{!state.activeRevision ? <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">AKTIF</span>
													: <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs" disabled={Boolean(busy)}
														onClick={() => void openPreview(state, null)}>Aktifkan<span className="sr-only"> model bawaan</span></Button>}
											</div>}
										</section>
									</div>
								</details>
							</article>
						);
					})}
				</section>
			</div>
			{preview && (
				<section ref={previewSection} tabIndex={-1} aria-label="Preview model LBY"
					className="space-y-4 px-4 pt-5 outline-none md:px-6">
					<div className="flex items-center justify-between gap-3">
						<h2 className="font-bold">{preview.location?.projectName ?? "Preview model"}</h2>
						<Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={closePreview}>Kembali ke daftar</Button>
					</div>
					{preview.error ? (
						<div role="alert" className="space-y-3 rounded-xl border p-4">
							<p>{preview.error}</p>
							<Button onClick={() => void openPreview(preview.state, preview.revision)}>Coba lagi</Button>
						</div>
					) : preview.location ? (
						<div className="flex h-[60dvh] min-h-96 flex-col overflow-hidden rounded-2xl border bg-card md:h-[72dvh]">
							<PanelLocationViewer key={preview.state.projectKey + ":" + preview.revision}
								{...preview.location} immersive preview desktopLayout embedded />
						</div>
					) : <div role="status" className="flex h-[60dvh] min-h-96 items-center justify-center gap-2 rounded-2xl border md:h-[72dvh]">
						<LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> Memuat preview...
					</div>}
					{preview.revision !== preview.state.activeRevision && (
						<div className="space-y-3 rounded-2xl border bg-card p-4">
							<p className="text-sm">Cocokkan bentuk model dan ruang dengan model di LBY.</p>
							<p className="text-xs text-muted-foreground">
								{preview.state.activeRevision || preview.state.bundledVersion
									? "Model saat ini tetap digunakan sampai Anda konfirmasi. " : "Model ini belum digunakan. "}
								Setelah diaktifkan, pencarian lokasi panel berikutnya memakai versi ini. Versi sebelumnya tetap tersimpan untuk pemulihan.
							</p>
							<label className="flex items-start gap-2 text-sm">
								<input type="checkbox" checked={checked} disabled={!preview.location || Boolean(busy)}
									onChange={(event) => setChecked(event.target.checked)} className="mt-1 size-4 accent-primary" />
								Sudah saya periksa dan sesuai dengan LBY
							</label>
							<Button disabled={!preview.location || !checked || Boolean(busy)}
								onClick={() => setReview({ state: preview.state, revision: preview.revision })}>
								{preview.revision === null ? "Gunakan model bawaan" : preview.state.activeRevision || preview.state.bundledVersion
									? "Gunakan versi V" + (preview.location?.versionNumber ?? "...") : "Aktifkan model"}
							</Button>
						</div>
					)}
				</section>
			)}


			<Dialog
				open={Boolean(review)}
				onOpenChange={(open) => {
					if (!open && busy !== "activating") setReview(null);
				}}
			>
				<DialogContent showCloseButton={busy !== "activating"}>
					<DialogTitle>Gunakan model ini?</DialogTitle>
					<DialogDescription>
						{review?.revision === null
							? "Konfirmasi untuk kembali ke model bawaan."
							: `Setelah memeriksa preview, konfirmasi untuk menggunakan ${review?.state.versions.find((version) => version.revision === review.revision)?.name ?? "model ini"}.`}{" "}
						Scan berikutnya akan memakai model ini. Model sebelumnya tetap
						tersimpan untuk pemulihan.
					</DialogDescription>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={Boolean(busy)}
							onClick={() => setReview(null)}
						>
							Periksa nanti
						</Button>
						<Button
							disabled={Boolean(busy) || !preview?.location || !checked}
							aria-busy={busy === "activating"}
							onClick={() => {
								if (review && preview?.location && checked)
									void run("activating", review.state, review.revision);
							}}
						>
							{busy === "activating" && (
								<LoaderCircle
									aria-hidden="true"
									className="size-4 animate-spin"
								/>
							)}
							Gunakan model ini
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
