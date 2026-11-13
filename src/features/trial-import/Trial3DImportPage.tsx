"use client";

import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type FormEvent,
} from "react";
import Link from "next/link";
import { Check, Circle, EllipsisVertical, LoaderCircle, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PanelViewerDetailPage } from "@/features/panel-viewer/PanelViewerDetailPage";
import type { TrialPublicModel } from "@/types/publicModel";
import {
	STATUS_BADGE_CLASS_NAME,
	STATUS_COLOR_CONFIG,
} from "@/lib/colorStatusConfig";

const activeStatusStyle = {
	"--status-color": STATUS_COLOR_CONFIG.TERPASANG_DIGUNAKAN.color,
	"--status-text-color": STATUS_COLOR_CONFIG.TERPASANG_DIGUNAKAN.textColor,
} as CSSProperties;
const previewStatusStyle = {
	"--status-color": STATUS_COLOR_CONFIG.SEDANG_DIPACKING.color,
	"--status-text-color": STATUS_COLOR_CONFIG.SEDANG_DIPACKING.textColor,
} as CSSProperties;

const importSteps = [
	{ stage: "downloading", label: "Mengunduh model" },
	{ stage: "panels", label: "Membaca panel" },
	{ stage: "rooms", label: "Menyusun ruang" },
	{ stage: "textures", label: "Mengunduh texture" },
	{ stage: "saving", label: "Menyimpan versi" },
] as const;

export function Trial3DImportPage({ workspace = "Admin" }: { workspace?: "Admin" | "Drafter" }) {
	const [url, setUrl] = useState("");
	const [search, setSearch] = useState("");
	const [models, setModels] = useState<TrialPublicModel[]>([]);
	const [preview, setPreview] = useState<{
		model: TrialPublicModel;
		revision: string;
		rooms: { id: string; name: string }[];
	} | null>(null);
	const [checked, setChecked] = useState(false);
	const [ready, setReady] = useState(false);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [importStage, setImportStage] = useState<
		(typeof importSteps)[number]["stage"] | null
	>(null);
	const importController = useRef<AbortController | null>(null);
	const urlInput = useRef<HTMLInputElement>(null);
	useEffect(() => () => importController.current?.abort(), []);
	async function load() {
		const response = await fetch("/api/admin/trial-3d-import", {
			cache: "no-store",
		});
		if (!response.ok) throw new Error("Daftar model tidak dapat dimuat.");
		const data = (await response.json()).models as TrialPublicModel[];
		setModels(data);
		return data;
	}
	useEffect(() => {
		load()
			.catch((error) => setMessage(error.message))
			.finally(() => setLoading(false));
	}, []);
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setMessage("");
		const controller = new AbortController();
		importController.current = controller;
		setImportStage("downloading");
		try {
			const response = await fetch("/api/admin/trial-3d-import", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/x-ndjson",
				},
				body: JSON.stringify({ url }),
				signal: AbortSignal.any([
					controller.signal,
					AbortSignal.timeout(290000),
				]),
			});
			let result:
				| {
						ok?: boolean;
						error?: string;
						id?: string;
						revision?: string;
						created?: boolean;
				  }
				| undefined;
			if (
				response.body &&
				response.headers.get("content-type")?.includes("application/x-ndjson")
			) {
				const reader = response.body
					.pipeThrough(new TextDecoderStream())
					.getReader();
				let buffer = "";
				try {
					while (true) {
						const { value, done } = await reader.read();
						buffer += value ?? "";
						const lines = buffer.split("\n");
						buffer = lines.pop() ?? "";
						if (done && buffer.trim()) lines.push(buffer);
						for (const line of lines.filter((item) => item.trim())) {
							const item = JSON.parse(line);
							const step = importSteps.find(
								(entry) => entry.stage === item.stage,
							);
							if (step) setImportStage(step.stage);
							else result = item;
						}
						if (done) break;
					}
				} finally {
					reader.releaseLock();
				}
			} else result = await response.json();
			if (!response.ok || !result?.ok)
				throw new Error(
					result?.error ??
						"Import gagal. Muat ulang untuk memeriksa versi tersimpan.",
				);
			setUrl("");
			try {
				const updated = await load();
				const model = updated.find((item) => item.id === result.id);
				const version = model?.versions.find(
					(item) => item.revision === result.revision,
				);
				setMessage(
					`${result.created ? "Versi baru disimpan" : "Tidak ada perubahan: cocok dengan versi tersimpan"}${version ? ` V${version.number}` : ""}${model?.activeRevision === result.revision ? " (aktif)" : ""}. Periksa preview sebelum aktivasi.`,
				);
			} catch {
				setMessage(
					"Model berhasil diimport, tetapi daftar gagal dimuat. Muat ulang halaman.",
				);
			}
		} catch (error) {
			setMessage(
				controller.signal.aborted
					? "Permintaan import dibatalkan. Muat ulang untuk memeriksa apakah versi tersimpan; versi aktif tetap digunakan."
					: error instanceof Error &&
						  ["TimeoutError", "AbortError"].includes(error.name)
						? "Import melewati batas waktu. Muat ulang untuk memeriksa versi tersimpan."
						: error instanceof Error
							? error.message
							: "Import gagal.",
			);
		} finally {
			importController.current = null;
			setImportStage(null);
			setBusy(false);
		}
	}
	async function openPreview(model: TrialPublicModel, revision: string) {
		setBusy(true);
		setMessage("");
		try {
			const response = await fetch(
				`/api/admin/trial-3d-import?${new URLSearchParams({ id: model.id, revision })}`,
			);
			if (!response.ok) throw new Error("Preview tidak dapat dimuat.");
			const data = await response.json();
			setChecked(false);
			setReady(false);
			setPreview({ model, revision, rooms: data.rooms });
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Preview gagal.");
		} finally {
			setBusy(false);
		}
	}
	async function activate() {
		if (!preview || !checked || !ready || busy) return;
		setBusy(true);
		try {
			const response = await fetch("/api/admin/trial-3d-import", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: preview.model.id,
					revision: preview.revision,
					expected: preview.model.activeRevision,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error);
			setPreview(null);
			setMessage("Versi model berhasil diaktifkan.");
			await load();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Aktivasi gagal.");
			setPreview(null);
		} finally {
			setBusy(false);
		}
	}
	async function deactivate(model: TrialPublicModel) {
		if (!model.activeRevision || busy || !window.confirm(`Nonaktifkan model 3D ${model.name}? Model tidak lagi muncul dalam pencarian aktif. Viewer old hanya tersedia jika data old ada. Versi yang belum diverifikasi harus diimport ulang sebelum dapat diaktifkan kembali.`)) return;
		setBusy(true);
		try {
			const response = await fetch("/api/admin/trial-3d-import", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: model.id, revision: null, expected: model.activeRevision }) });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error);
			setMessage("Model 3D dinonaktifkan. Data dan riwayat tetap tersimpan; gunakan viewer old bila diperlukan.");
			await load();
		} catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menonaktifkan model."); }
		finally { setBusy(false); }
	}
	const filtered = models.filter((model) =>
		model.name.toLowerCase().includes(search.trim().toLowerCase()),
	);
	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-28">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-8 text-accent-foreground">
				<img
					src="/ayune-14.svg"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -top-20 -right-16 size-70 opacity-10"
				/>
				<div className="relative pr-12">
					<DropdownMenu>
						<DropdownMenuTrigger aria-label="Menu model" className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-full hover:bg-background/50 focus-visible:outline-2 focus-visible:outline-ring">
							<EllipsisVertical aria-hidden="true" className="size-5" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem render={<Link href="/cari-lokasi" />}>Buka pencarian lokasi</DropdownMenuItem>
							<DropdownMenuItem render={<Link href={workspace === "Admin" ? "/admin/import-3d/old" : "/drafter/old"} />}>Kelola model LBY old</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<p className="text-md text-muted-foreground/80">{workspace}</p>
					<h1 className="text-2xl font-extrabold tracking-tight">
						Model LBY 3D Ver2
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Kelola model aktif untuk pencarian lokasi panel.
					</p>
				</div>
			</header>
			<div className="space-y-6 px-4 pt-5">
				{importStage ? (
					<section
						aria-label="Progres import"
						className="rounded-[1.35rem] border border-border/40 bg-card p-4 shadow-sm"
					>
						<h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
							Sedang mengimport
						</h2>
						<ol className="my-5 space-y-4">
							{importSteps.map((step, index) => {
								const current = importSteps.findIndex(
									(item) => item.stage === importStage,
								);
								return (
									<li
										key={step.stage}
										aria-current={index === current ? "step" : undefined}
										className={`flex items-center gap-3 text-sm ${index === current ? "font-medium text-foreground" : "text-muted-foreground"}`}
									>
										{index < current ? (
											<Check
												aria-hidden="true"
												className="size-6 text-[#22c55e]"
											/>
										) : index === current ? (
											<LoaderCircle
												aria-hidden="true"
												className="size-6 motion-safe:animate-spin text-[#22c55e]"
											/>
										) : (
											<Circle
												aria-hidden="true"
												className="size-6 text-border"
											/>
										)}
										{step.label}
									</li>
								);
							})}
						</ol>
						<Progress
							aria-label="Progres tahapan import"
							value={importSteps.findIndex(
								(step) => step.stage === importStage,
							)}
							max={importSteps.length}
							className="gap-0 **:data-[slot=progress-track]:h-1.5 **:data-[slot=progress-indicator]:min-w-[15%] **:data-[slot=progress-indicator]:bg-[#22c55e]"
						/>
						<div className="mt-1 flex justify-end">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={importStage === "saving"}
								onClick={() => importController.current?.abort()}
								className="h-8 px-1 text-xs font-semibold text-destructive"
							>
								Batalkan
							</Button>
						</div>
						<p role="status" className="sr-only">
							{importSteps.find((step) => step.stage === importStage)?.label}
						</p>
					</section>
				) : (
					<form
						onSubmit={submit}
						className="space-y-4 rounded-[1.35rem] border border-border/40 bg-card p-4 shadow-sm"
					>
						<h2 className="font-bold">Import model baru</h2>
						<div className="space-y-2">
							<label htmlFor="trial-lby-url" className="text-sm font-medium">
								Link share LBY
							</label>
							<Input
								id="trial-lby-url"
								ref={urlInput}
								type="url"
								required
								maxLength={20000}
								value={url}
								onChange={(event) => setUrl(event.target.value)}
								disabled={busy}
								placeholder="https://www.lbyerp.com/#/cadVisitor?..."
								className="h-11 rounded-xl bg-background"
							/>
						</div>
						<p className="text-xs text-muted-foreground">
							Model disimpan sebagai kandidat. Periksa preview sebelum
							aktivasi.
						</p>
						<Button
							type="submit"
							disabled={busy || !url.trim()}
							className="w-full rounded-xl"
						>
							{busy ? <LoaderCircle className="animate-spin" /> : <Upload />}{" "}
							{busy ? "Mengimport model..." : "Import model"}
						</Button>
					</form>
				)}
				{message && (
					<p role="status" className="text-sm">
						{message}
					</p>
				)}
				<section className="space-y-3" aria-busy={loading}>
					<div className="flex items-center justify-between">
						<h2 className="font-bold">Model tersimpan</h2>
						<span className="text-xs text-muted-foreground">
							{filtered.length} model
						</span>
					</div>
					<div className="relative">
						<Search
							aria-hidden="true"
							className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							type="search"
							aria-label="Cari model tersimpan"
							placeholder="Cari nama model..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="h-11 rounded-xl pl-9"
						/>
					</div>
					{loading ? (
						<p role="status" className="text-sm text-muted-foreground">
							Memuat model...
						</p>
					) : filtered.length ? (
						filtered.map((model) => {
							const latest = model.versions[0];
							if (!latest) return null;
							const candidate = latest.revision !== model.activeRevision;
							return (
								<article
									key={model.id}
									aria-label={model.name}
									style={candidate ? previewStatusStyle : activeStatusStyle}
									className={`overflow-hidden rounded-2xl border bg-card text-card-foreground ${candidate ? "border-[color-mix(in_srgb,var(--status-color)_40%,transparent)]" : "border-border/60"}`}
								>
									<details className="group/model">
										<summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition-colors hover:bg-muted/40 group-open/model:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
											<span
												style={
													model.activeRevision
														? activeStatusStyle
														: previewStatusStyle
												}
												aria-label={
													model.activeRevision
														? "Sedang digunakan"
														: "Belum digunakan"
												}
												className="size-2 shrink-0 rounded-full bg-(--status-color) ring-4 ring-[color-mix(in_srgb,var(--status-color)_12%,transparent)]"
											/>
											<div className="min-w-0 flex-1">
												<h3
													className="truncate text-sm font-bold"
													title={model.name}
												>
													{model.name}
												</h3>
												<p className="mt-0.5 truncate text-xs text-muted-foreground">
													V{latest.number} ·{" "}
													{new Date(latest.importedAt).toLocaleString("id-ID", {
														timeZone: "Asia/Jakarta",
														day: "2-digit",
														month: "2-digit",
														hour: "2-digit",
														minute: "2-digit",
													})}
												</p>
											</div>
											<Badge
												variant="outline"
												style={
													candidate ? previewStatusStyle : activeStatusStyle
												}
												className={
													STATUS_BADGE_CLASS_NAME +
													" rounded-full px-2 py-1 text-[10px] font-semibold"
												}
											>
												{candidate ? "Perlu preview" : "Aktif"}
											</Badge>
											<span
												aria-hidden="true"
												className="text-xs text-muted-foreground transition-transform group-open/model:rotate-180"
											>
												&#9662;
											</span>
										</summary>
										<div className="space-y-4 border-t border-border/50 p-4">
											{model.activeRevision && <Button type="button" variant="outline" disabled={busy} className="w-full" onClick={() => void deactivate(model)}>Nonaktifkan model 3D (gunakan old)</Button>}
											<div className="grid grid-cols-2 gap-2">
												<Button
													type="button"
													disabled={busy}
													className="h-11 rounded-xl shadow-sm"
													onClick={() =>
														void openPreview(model, latest.revision)
													}
												>
													Preview 3D
												</Button>
												<Button
													type="button"
													variant="outline"
													disabled={busy}
													className="h-11 rounded-xl"
													onClick={() => {
														urlInput.current?.focus();
														urlInput.current?.scrollIntoView({
															block: "center",
															behavior: "smooth",
														});
													}}
												>
													Update model
												</Button>
											</div>
											<section
												aria-label="Riwayat versi"
												className="rounded-xl bg-muted/30 p-3"
											>
												<h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
													Riwayat versi
												</h4>
												{model.versions.map((version) => (
													<div
														key={version.revision}
														className="flex items-center justify-between gap-3 border-t border-dashed border-border/60 py-2 text-xs"
													>
														<p className="min-w-0">
															V{version.number} ·{" "}
															{new Date(version.importedAt).toLocaleString(
																"id-ID",
																{
																	timeZone: "Asia/Jakarta",
																	day: "2-digit",
																	month: "2-digit",
																	hour: "2-digit",
																	minute: "2-digit",
																},
															)}
														</p>
														{version.revision === model.activeRevision ? (
															<div className="flex shrink-0 items-center gap-2">
																{version.revision !== latest.revision && (
																	<Button
																		type="button"
																		variant="outline"
																		size="sm"
																		className="h-8 rounded-xl text-xs"
																		disabled={busy}
																		onClick={() =>
																			void openPreview(model, version.revision)
																		}
																	>
																		Preview
																		<span className="sr-only">
																			{" "}
																			V{version.number}
																		</span>
																	</Button>
																)}
																<Badge
																	variant="outline"
																	style={activeStatusStyle}
																	className={
																		STATUS_BADGE_CLASS_NAME +
																		" rounded-full px-3 py-1 text-[10px] font-bold"
																	}
																>
																	AKTIF
																</Badge>
															</div>
														) : (
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="h-8 shrink-0 rounded-xl text-xs"
																disabled={busy}
																onClick={() =>
																	void openPreview(model, version.revision)
																}
															>
																Aktifkan
																<span className="sr-only">
																	{" "}
																	V{version.number}
																</span>
															</Button>
														)}
													</div>
												))}
											</section>
										</div>
									</details>
								</article>
							);
						})
					) : (
						<p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
							Tidak ada model yang ditemukan.
						</p>
					)}
				</section>
			</div>
			{preview && (
				<section
					className="fixed inset-x-0 top-0 bottom-(--bottom-navigation-height) z-40 bg-background"
					aria-label="Preview versi model"
				>
					<PanelViewerDetailPage
						id={preview.model.id}
						rooms={preview.rooms}
						trialRevision={preview.revision}
						onReady={setReady}
						footer={
							preview.revision !== preview.model.activeRevision && (
								<div className="space-y-2">
									<label className="flex items-center gap-2 text-sm">
										<Checkbox
											checked={checked}
											disabled={!ready}
											onCheckedChange={setChecked}
											className="size-5 shrink-0"
										/>
										Sudah saya periksa dan sesuai dengan LBY
									</label>
									<Button
										className="w-full"
										disabled={!checked || !ready || busy}
										onClick={() => void activate()}
									>
										Gunakan versi ini
									</Button>
								</div>
							)
						}
					/>
					<div className="absolute inset-x-3 top-3 z-10 flex items-start gap-2">
						<Button variant="outline" onClick={() => setPreview(null)}>
							Kembali
						</Button>
						<span
							className="min-w-0 truncate rounded-lg border bg-card p-2 text-sm font-bold"
							title={preview.model.name}
						>
							{preview.model.name}
						</span>
					</div>
				</section>
			)}
		</main>
	);
}
