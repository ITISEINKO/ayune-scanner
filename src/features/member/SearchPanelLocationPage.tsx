"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Scanner } from "@/components/scanner";
import { buttonVariants } from "@/components/ui/button";
import { PanelLocationViewer } from "@/features/panel-location/PanelLocationViewer";
import { PanelViewerDetailPage } from "@/features/panel-viewer/PanelViewerDetailPage";
import type { PanelLocationView } from "@/types/panelLocation";
import type { TrialPanelMatch } from "@/types/publicModel";
import { panelDisplayName } from "@/lib/panelLocation";

export const SearchPanelLocationPage = ({
	serialNumber,
	location,
	errorMessage,
	trialMatches,
	models,
	selectedModel,
	oldSource,
	hasNavigation,
}: {
	serialNumber: string;
	location: PanelLocationView | null;
	errorMessage: string;
	trialMatches: TrialPanelMatch[];
	models: { id: string; name: string }[];
	selectedModel: {
		id: string;
		name: string;
		revision: string;
		rooms: { id: string; name: string }[];
	} | null;
	oldSource: boolean;
	hasNavigation: boolean;
}) => {
	const router = useRouter();
	const finding = useRef(false);
	const [searching, startSearch] = useTransition();
	const [selectedMatch, setSelectedMatch] = useState(
		trialMatches.length === 1 ? 0 : -1,
	);
	const trial = trialMatches[selectedMatch];
	const findPanel = (value: string) => {
		const code = value.trim();
		if (!code || finding.current) return;
		if (code.length > 100) {
			toast.error("Serial number terlalu panjang.");
			return;
		}
		finding.current = true;
		startSearch(() =>
			router.push(`/cari-lokasi?${new URLSearchParams({ barcode: code })}`),
		);
	};
	const panel = location?.panels.find((item) => item.barcode === serialNumber);
	const title = trial
		? `${trial.name} · ${trial.roomName}`
		: location
			? `${location.projectName}${panel ? ` · ${panel.roomName}` : ""}`
			: "Lokasi panel";

	return (
		<main
			className={
				serialNumber || selectedModel
					? `relative mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-neutral-50 md:max-w-none dark:bg-background ${hasNavigation ? "pb-(--bottom-navigation-height)" : ""}`
					: "mx-auto min-h-dvh max-w-lg p-4 pb-28"
			}
		>
			{serialNumber || selectedModel ? (
				<header className="absolute inset-x-3 top-3 z-20 flex min-w-0 items-center gap-2">
					<Link
						href="/cari-lokasi"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className:
								"h-10 rounded-full border-border/50 bg-card/95 px-3 shadow-sm",
						})}
					>
						<ArrowLeft aria-hidden="true" />
					</Link>
					<h1
						title={selectedModel?.name ?? title}
						className="min-w-0 flex-1 truncate rounded-full border border-border/50 bg-card/95 px-3 py-3 text-center text-[11px] font-bold shadow-sm"
					>
						{selectedModel?.name ?? title}
					</h1>
				</header>
			) : (
				<>
					<header className="mb-7">
						<div className="flex items-center gap-3">
							<div className="size-19 shrink-0 overflow-hidden">
								<img src="/icon.svg" alt="" className="size-full" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
									Produksi Panel
								</p>
								<h1 className="text-xl font-black tracking-tight">
									Cari lokasi panel
								</h1>
							</div>
							{!hasNavigation && (
								<Link
									href="/login"
									className={buttonVariants({
										variant: "outline",
										size: "sm",
										className: "h-10 rounded-xl px-3",
									})}
								>
									Login
								</Link>
							)}
						</div>
						<p className="mt-2 text-sm text-muted-foreground">
							Scan atau masukkan serial panel untuk melihat lokasinya.
						</p>
					</header>
					<Scanner onDetected={findPanel} disabled={searching} />
					<section className="mt-7" aria-label="Semua model">
						<h2 className="font-bold">Semua model</h2>
						{models.length ? (
							<ul className="mt-3 grid gap-3">
								{models.map((item) => (
									<li key={item.id}>
										<Link
											className="block rounded-xl border bg-card p-4 font-semibold hover:bg-muted"
											href={`/cari-lokasi?${new URLSearchParams({ model: item.id })}`}
										>
											{item.name}
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p className="mt-3 text-sm text-muted-foreground">
								Belum ada model aktif yang diimpor.
							</p>
						)}
					</section>
					{searching && (
						<p
							role="status"
							className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
						>
							<LoaderCircle
								aria-hidden="true"
								className="size-4 animate-spin"
							/>
							Mencari lokasi panel…
						</p>
					)}
				</>
			)}
			{selectedModel && (
				<div className="relative min-h-0 flex-1">
					<PanelViewerDetailPage
						id={selectedModel.id}
						rooms={selectedModel.rooms}
						trialRevision={selectedModel.revision}
						locationViewer
						canvasBehindNavigation={hasNavigation}
					/>
				</div>
			)}
			{errorMessage && (
				<p
					role="alert"
					className="mx-4 mt-20 rounded-xl border bg-card p-5 text-sm"
				>
					{errorMessage}
					{!oldSource && serialNumber && (
						<Link
							className="mt-3 block underline"
							href={`/cari-lokasi?${new URLSearchParams({ barcode: serialNumber, source: "old" })}`}
						>
							Cari di viewer old
						</Link>
					)}
				</p>
			)}
			{trialMatches.length > 1 && selectedMatch < 0 && (
				<div className="relative z-10 mt-20 space-y-2 p-4">
					<p className="text-sm">
						Serial ditemukan di beberapa model. Pilih project:
					</p>
					{trialMatches.map((match, index) => (
						<button
							type="button"
							key={`${match.modelId}:${match.roomId}:${match.panelId}`}
							className="block w-full rounded-lg border bg-card p-3 text-left text-sm"
							onClick={() => setSelectedMatch(index)}
						>
							{match.name} · {match.roomName}
						</button>
					))}
				</div>
			)}
			{trial && (
				<div className="relative min-h-0 flex-1">
					<PanelViewerDetailPage
						id={trial.modelId}
						rooms={[{ id: trial.roomId, name: trial.roomName }]}
						initialRoom={trial.roomId}
						selectedPanel={trial.panelId}
						trialRevision={trial.revision}
						hideRoomSelector
						locationViewer
						canvasBehindNavigation={hasNavigation}
						footer={
							<section
								aria-label="Informasi panel"
								className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
							>
								<h2 className="text-sm font-bold">
									{trial.number ? `Panel ${trial.number}` : "Panel"}
								</h2>
								<p className="text-xs text-muted-foreground">
									Serial: {serialNumber}
								</p>
								<Link
									className="text-xs underline"
									href={`/cari-lokasi?${new URLSearchParams({ barcode: serialNumber, source: "old" })}`}
								>
									Viewer old
								</Link>
							</section>
						}
					/>
				</div>
			)}
			{location && (
				<>
					<p
						role="status"
						className="absolute left-3 top-16 z-20 rounded-full bg-card px-3 py-1 text-xs"
					>
						Viewer old
					</p>
					<PanelLocationViewer {...location} immersive />
					<section
						aria-label="Informasi panel"
						className="relative z-10 shrink-0 rounded-t-[1.75rem] border-t border-border/60 bg-card px-5 py-4"
					>
						<h2 className="text-lg font-extrabold leading-snug wrap-anywhere">
							{panelDisplayName(
								panel?.panelName,
								panel?.panelNumber ? `Panel ${panel.panelNumber}` : "Panel",
							)}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{panel?.panelNumber ? `Panel ${panel.panelNumber} · ` : ""}Serial:{" "}
							{serialNumber}
						</p>
					</section>
				</>
			)}
		</main>
	);
};
