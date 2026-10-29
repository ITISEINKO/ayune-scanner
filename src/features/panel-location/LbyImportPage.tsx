"use client";

import { useEffect, useRef, useState } from "react";
import {
	Check,
	Circle,
	ClipboardPaste,
	Clock3,
	Copy,
	Eye,
	LoaderCircle,
	LockKeyhole,
	Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type {
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

export function LbyImportPage() {
	const [url, setUrl] = useState("");
	const [states, setStates] = useState<LbyImportState[]>([]);
	const [busy, setBusy] = useState<
		"loading" | "importing" | "activating" | null
	>("loading");
	const [activatingVersion, setActivatingVersion] = useState("");
	const [filter, setFilter] = useState("Semua");
	const versions = states.flatMap((state) =>
		state.versions.map((version) => ({
			state,
			version,
			active: state.activeRevision === version.revision,
		})),
	);
	const visibleVersions = versions.filter(
		({ active }) =>
			filter === "Semua" || (filter === "Aktif" ? active : !active),
	);
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
		setActivatingVersion(
			action === "activating"
				? `${state?.projectKey}:${revision ?? "bundled"}`
				: "",
		);
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
									? { url }
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
				setFilter("Semua");
				toast.success(
					"Import berhasil disimpan. Periksa preview, lalu klik Aktifkan untuk memakai versi ini.",
				);
			}
			if (action === "activating")
				toast.success(
					"Model berhasil diaktifkan. Scan berikutnya memakai versi ini.",
				);
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
			setActivatingVersion("");
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
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-28">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-8 text-accent-foreground">
				<img
					src="/ayune-14.svg"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -top-20 -right-16 z-0 size-70 opacity-10"
				/>
				<div className="relative z-10">
					<p className="text-md text-muted-foreground/80">Drafter</p>
					<h1 className="text-2xl font-extrabold tracking-tight">Model LBY</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Import link LBY, periksa preview, lalu aktifkan model untuk
						pencarian lokasi panel.
					</p>
				</div>
			</header>
			<div className="space-y-6 px-4 pt-5">
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
											className="size-6 text-violet-500"
										/>
									) : index === stepIndex ? (
										<LoaderCircle
											aria-hidden="true"
											className="size-6 motion-safe:animate-spin text-violet-400"
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
							className="gap-0 **:data-[slot=progress-track]:h-1.5 **:data-[slot=progress-indicator]:min-w-[15%] **:data-[slot=progress-indicator]:bg-violet-400"
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
						<div className="space-y-2">
							<label
								htmlFor="lby-share-url"
								className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
							>
								<span
									aria-hidden="true"
									className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
								>
									1
								</span>
								Tempel link share LBY
							</label>
							<div className="relative">
								<Input
									id="lby-share-url"
									aria-label="Link share LBY"
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
						<div className="space-y-2 text-xs text-muted-foreground">
							<p className="flex items-center gap-2">
								<Clock3 aria-hidden="true" className="size-4 shrink-0" />
								Butuh 12–20 detik atau lebih, maksimal 4 menit
							</p>
							<p className="flex items-center gap-2">
								<LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
								Link preview tidak disimpan
							</p>
						</div>
						<Button
							type="submit"
							disabled={Boolean(busy) || !url.trim()}
							className="w-full rounded-xl"
						>
							<Upload aria-hidden="true" />
							Import model
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
								{versions.length} versi ·{" "}
								{versions.filter(({ active }) => active).length} aktif
							</p>
						)}
					</div>
					<div
						role="group"
						aria-label="Filter model"
						className="flex flex-wrap gap-2"
					>
						{["Semua", "Aktif", "Belum aktif"].map((label) => (
							<Button
								key={label}
								type="button"
								size="sm"
								variant={filter === label ? "default" : "outline"}
								aria-pressed={filter === label}
								disabled={busy === "loading"}
								onClick={() => setFilter(label)}
								className="rounded-full px-4 text-xs"
							>
								{label}
							</Button>
						))}
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
									className="rounded-[1.35rem] border border-border/40 bg-card p-4"
								>
									<div className="flex h-6 items-center justify-between">
										<Skeleton className="h-5 w-16 rounded-full" />
										<Skeleton className="h-6 w-10 rounded-full" />
									</div>
									<Skeleton className="mt-2 h-5 w-3/4 rounded-md" />
									<div className="mt-3 grid grid-cols-3 gap-2">
										{[0, 1, 2].map((stat) => (
											<Skeleton key={stat} className="h-16 rounded-xl" />
										))}
									</div>
									<div className="mt-3 space-y-1">
										<Skeleton className="h-6 w-4/5 rounded-md" />
										<Skeleton className="h-4 w-1/2 rounded-md" />
										<Skeleton className="h-4 w-2/3 rounded-md" />
									</div>
									<Skeleton className="mt-3 h-10 w-full rounded-xl" />
								</div>
							))}
						</div>
					)}
					{states
						.filter((state) => state.bundledVersion)
						.map((state) => (
							<div
								key={state.projectKey}
								className="space-y-2 rounded-xl border border-border/40 p-3"
							>
								<p className="text-xs text-muted-foreground">
									{state.projectKey} · Model bawaan V1
									{!state.activeRevision && " masih aktif."}
								</p>
								{state.bundledVersion && state.activeRevision && (
									<Button
										size="sm"
										variant="outline"
										disabled={Boolean(busy)}
										aria-busy={
											activatingVersion === `${state.projectKey}:bundled`
										}
										onClick={() => void run("activating", state, null)}
									>
										{activatingVersion === `${state.projectKey}:bundled` && (
											<LoaderCircle
												aria-hidden="true"
												className="animate-spin"
											/>
										)}
										Gunakan model bawaan V1
									</Button>
								)}
							</div>
						))}
					{!busy && versions.length === 0 && (
						<p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
							Belum ada model yang diimpor.
						</p>
					)}
					{versions.length > 0 && visibleVersions.length === 0 && (
						<p className="py-6 text-center text-sm text-muted-foreground">
							Tidak ada versi {filter.toLowerCase()}.
						</p>
					)}
					{visibleVersions.map(({ state, version, active }) => (
						<article
							key={`${state.projectKey}-${version.revision}`}
							aria-label={`${version.name} V${version.versionNumber}`}
							className="rounded-[1.35rem] border border-border/40 bg-card p-4 text-card-foreground"
						>
							<div className="flex items-center justify-between gap-3">
								<span
									className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
								>
									{active ? "● Aktif" : "Belum aktif"}
									{version.revision === state.versions[0]?.revision &&
										" · Terbaru"}
								</span>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									disabled={Boolean(busy) || active}
									onClick={() =>
										void run("activating", state, version.revision)
									}
									aria-busy={
										activatingVersion ===
										`${state.projectKey}:${version.revision}`
									}
									title={
										active
											? "Versi ini aktif. Aktifkan versi lain untuk menggantinya."
											: `Aktifkan ${version.name}`
									}
									className={`h-6 w-10 rounded-full p-0 disabled:opacity-100 ${active ? "bg-emerald-600" : "bg-muted hover:bg-accent"}`}
								>
									<span className="sr-only">
										{active ? "Aktif" : "Aktifkan"}
									</span>
									{activatingVersion ===
									`${state.projectKey}:${version.revision}` ? (
										<LoaderCircle
											aria-hidden="true"
											className="size-4 animate-spin"
										/>
									) : (
										<span
											aria-hidden="true"
											className={`size-5 rounded-full bg-white shadow-sm ${active ? "translate-x-2" : "-translate-x-2"}`}
										/>
									)}
								</Button>
							</div>
							<h3 className="mt-2 text-sm font-extrabold wrap-anywhere">
								{version.name}
							</h3>
							<dl className="mt-3 grid grid-cols-3 gap-2">
								<div className="flex min-w-0 flex-col gap-1 rounded-xl bg-background p-3">
									<dt className="order-2 text-[10px] text-muted-foreground">
										Panel
									</dt>
									<dd className="text-sm font-bold">{version.panelCount}</dd>
								</div>
								<div className="flex min-w-0 flex-col gap-1 rounded-xl bg-background p-3">
									<dt className="order-2 text-[10px] text-muted-foreground">
										Ruang
									</dt>
									<dd className="text-sm font-bold">{version.roomCount}</dd>
								</div>
								<div className="flex min-w-0 flex-col justify-end gap-1 rounded-xl bg-background p-3">
									<dt className="text-[10px] text-muted-foreground">Versi</dt>
									<dd className="text-[10px] font-semibold wrap-anywhere">
										V{version.versionNumber}
									</dd>
								</div>
							</dl>
							<div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
								<p className="flex flex-wrap items-center gap-x-1">
									Order{" "}
									<span className="text-foreground wrap-anywhere">
										{version.orderId}
									</span>
									<Button
										type="button"
										variant="ghost"
										size="xs"
										aria-label={`Salin order ${version.orderId}`}
										className="h-6 px-1 text-[11px]"
										onClick={async () => {
											try {
												await navigator.clipboard.writeText(version.orderId);
												toast.success("Order ID disalin.");
											} catch {
												toast.error(
													"Order ID tidak dapat disalin. Pilih dan salin teks order secara manual.",
												);
											}
										}}
									>
										<Copy aria-hidden="true" className="size-4" />
									</Button>
								</p>
								<p className="wrap-anywhere">
									Contoh serial{" "}
									<span className="text-foreground">
										{version.sampleBarcode}
									</span>
								</p>
								<p>
									Diimpor{" "}
									{new Date(version.importedAt).toLocaleString("id-ID", {
										timeZone: "Asia/Jakarta",
									})}
								</p>
							</div>
							<div className="mt-3">
								<a
									href={`/panel-location?${new URLSearchParams({ project: state.projectKey, barcode: version.sampleBarcode, revision: version.revision })}`}
									target="_blank"
									rel="noopener noreferrer"
									className={buttonVariants({
										variant: "outline",
										size: "sm",
										className: "min-h-10 w-full rounded-xl",
									})}
								>
									<Eye aria-hidden="true" />
									Preview
								</a>
							</div>
						</article>
					))}
				</section>
			</div>
		</main>
	);
}
