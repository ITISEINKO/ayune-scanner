"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
	DoorOpen,
	EyeOff,
	ScanEye,
	Hash,
	Bone,
	DoorClosed,
	ChevronDown,
	ChevronUp,
	TriangleAlert,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PanelLocationLoader } from "@/features/panel-location/PanelLocationLoader";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useRoomModel } from "./useRoomModel";
import { createPanelViewer } from "./panelViewer";
import type { PanelHpl } from "@/types/publicModel";

export function PanelViewerDetailPage({
	id,
	rooms,
	initialRoom,
	selectedPanel,
	initialSerial,
	initialNumber,
	trialRevision,
	hideRoomSelector = false,
	locationViewer = false,
	canvasBehindNavigation = false,
	onReady,
	footer,
}: {
	id: string;
	rooms: { id: string; name: string }[];
	initialRoom?: string;
	selectedPanel?: string;
	initialSerial?: string;
	initialNumber?: string;
	trialRevision: string;
	hideRoomSelector?: boolean;
	locationViewer?: boolean;
	canvasBehindNavigation?: boolean;
	onReady?: (ready: boolean) => void;
	footer?: ReactNode;
}) {
	const [room, setRoom] = useState(
		rooms.some((item) => item.id === initialRoom)
			? initialRoom!
			: (rooms[0]?.id ?? ""),
	);
	const [pickedPanel, setPickedPanel] = useState<{
		room: string;
		id: string;
		number: string;
	} | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [dismissedHingesRoom, setDismissedHingesRoom] = useState<string | null>(
		null,
	);
	const [hpl, setHpl] = useState<{
		key: string;
		panels: (PanelHpl & { room: string; id: string; syncedAt: string })[];
		syncedAt: string;
	} | null>(null);
	const [hplState, setHplState] = useState<
		"loading" | "ready" | "login" | "denied" | "error"
	>("loading");
	const hplRequest = useRef<AbortController | null>(null);
	const selectedId =
		pickedPanel?.room === room
			? pickedPanel.id
			: room === initialRoom
				? selectedPanel
				: undefined;
	const hplKey = `${id}:${trialRevision}`;
	function loadHpl(mode?: "panel") {
		hplRequest.current?.abort();
		const abort = new AbortController();
		hplRequest.current = abort;
		setHplState("loading");
		fetch(
			`/api/panel/hpl?${new URLSearchParams({ id, revision: trialRevision, ...(mode === "panel" && selectedId ? { roomId: room, panelId: selectedId } : {}) })}`,
			{ signal: abort.signal, ...(mode ? { method: "POST" } : {}) },
		)
			.then(async (response) => {
				if (response.status === 401) {
					if (!abort.signal.aborted) {
						setHplState("login");
					}
					return;
				}
				if (response.status === 403) {
					if (!abort.signal.aborted) setHplState("denied");
					return;
				}
				if (!response.ok) throw new Error("HPL unavailable");
				const data = (await response.json()) as {
					panels: (PanelHpl & { room: string; id: string; syncedAt?: string })[];
					syncedAt: string | null;
				};
				if (!abort.signal.aborted) {
					const panels = data.panels.map((panel) => ({ ...panel, syncedAt: panel.syncedAt ?? data.syncedAt ?? "" }));
					setHpl((previous) => mode === "panel" && previous?.key === hplKey
						? { key: hplKey, syncedAt: previous.syncedAt, panels: [...previous.panels.filter((panel) => !panels.some((updated) => updated.room === panel.room && updated.id === panel.id)), ...panels] }
						: { key: hplKey, syncedAt: data.syncedAt ?? "", panels });
					setHplState("ready");
				}
			})
			.catch(() => {
				if (!abort.signal.aborted) setHplState("error");
			});
	}
	useEffect(() => {
		if (!locationViewer || !trialRevision) return;
		loadHpl();
		return () => hplRequest.current?.abort();
	// The lookup belongs to the model revision, not the selected panel.
	}, [id, trialRevision, locationViewer]);
	const selectedHpl =
		hpl?.key === hplKey
			? hpl.panels.find(
					(panel) => panel.room === room && panel.id === selectedId,
				)
			: undefined;
	const {
		parts,
		status,
		setStatus,
		missingHinges,
		hingeCheckUnavailable,
		unresolvedDoors,
		hasDoors,
		hasDrawers,
	} = useRoomModel(id, room, trialRevision, locationViewer);
	const [doorsOpen, setDoorsOpen] = useState(false);
	const [hideDoors, setHideDoors] = useState(false);
	const [xray, setXray] = useState(false);
	const [numbers, setNumbers] = useState(false);
	const [explode, setExplode] = useState(0);
	const container = useRef<HTMLDivElement>(null);
	const viewer = useRef<Awaited<ReturnType<typeof createPanelViewer>> | null>(
		null,
	);
	const onReadyRef = useRef(onReady);
	const latest = useRef({
		room,
		initialRoom,
		selectedPanel,
		doorsOpen,
		hideDoors,
		xray,
		numbers,
		explode,
	});
	latest.current = {
		room,
		initialRoom,
		selectedPanel,
		doorsOpen,
		hideDoors,
		xray,
		numbers,
		explode,
	};
	onReadyRef.current = onReady;
	useEffect(() => {
		onReadyRef.current?.(status.kind === "ready");
	}, [status.kind]);
	useEffect(() => {
		if (parts && !hasDoors) setHideDoors(false);
		if (parts && !hasDoors && !hasDrawers) {
			setDoorsOpen(false);
		}
	}, [parts, hasDoors, hasDrawers]);
	useEffect(() => {
		if (!parts?.length || !container.current) return;
		let cancelled = false;
		let current: Awaited<ReturnType<typeof createPanelViewer>> | null = null;
		createPanelViewer(
			container.current,
			parts,
			id,
			trialRevision,
			locationViewer,
			locationViewer
				? (id, number) =>
						setPickedPanel({ room: latest.current.room, id, number })
				: undefined,
		)
			.then(async (result) => {
				if (cancelled) {
					result.dispose();
					return;
				}
				current = result;
				viewer.current = result;
				const state = latest.current;
				result.setSelected(
					state.room === state.initialRoom ? state.selectedPanel : undefined,
				);
				result.setDoorsOpen(state.doorsOpen);
				result.apply(state);
				await result.ready;
				if (!cancelled) {
					result.apply(latest.current);
					setStatus({ kind: "ready" });
				}
			})
			.catch((error) => {
				if (!cancelled) {
					console.error("Model tidak dapat dimuat:", error);
					setStatus({ kind: "error" });
				}
			});
		return () => {
			cancelled = true;
			current?.dispose();
			if (viewer.current === current) viewer.current = null;
		};
	}, [parts, id, trialRevision, locationViewer]);
	useEffect(() => {
		viewer.current?.setSelected(
			pickedPanel?.room === room
				? pickedPanel.id
				: room === initialRoom
					? selectedPanel
					: undefined,
		);
	}, [room, initialRoom, selectedPanel, pickedPanel]);
	useEffect(() => {
		viewer.current?.setDoorsOpen(doorsOpen);
	}, [doorsOpen]);
	useEffect(() => {
		viewer.current?.apply({ hideDoors, xray, numbers, explode });
	}, [hideDoors, xray, numbers, explode]);

	return (
		<section className="absolute inset-0" aria-label="Viewer model 3D">
			<div
				ref={container}
				className={`absolute inset-0 ${canvasBehindNavigation ? "-bottom-(--bottom-navigation-height)" : ""}`}
				aria-label="Model 3D interaktif"
			/>
			{status.kind !== "ready" && (
				<div className="absolute inset-0 flex bg-background">
					{status.kind === "loading" ? (
						<PanelLocationLoader message="Memuat model…" />
					) : (
						<p role="status" className="m-auto p-4 text-center">
							{status.kind === "empty"
								? "Tidak ada panel pada ruangan ini."
								: "Model tidak dapat dimuat. Coba pilih ruangan lagi."}
						</p>
					)}
				</div>
			)}
			{!hideRoomSelector && (
				<div className="absolute left-3 top-16 sm:left-5 sm:top-20">
					<Select
						value={room}
						onValueChange={(value) => {
							if (value) setRoom(value);
						}}
					>
						<SelectTrigger
							aria-label="Ruangan"
							className="max-w-56 border-border bg-card/95 shadow-sm"
						>
							<SelectValue>
								{rooms.find((item) => item.id === room)?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent
							align="start"
							alignItemWithTrigger={false}
							className="w-max min-w-(--anchor-width) max-w-[calc(100vw-1.5rem)]"
						>
							{rooms.map((item) => (
								<SelectItem
									key={item.id}
									value={item.id}
									className="[&>span:first-child]:min-w-0 [&>span:first-child]:shrink [&>span:first-child]:whitespace-normal [&>span:first-child]:wrap-break-word"
								>
									{item.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}
			<div
				className="absolute right-3 top-1/2 flex max-h-[60%] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-xl border bg-card/95 p-1.5 shadow-sm sm:right-5"
				role="toolbar"
				aria-label="Kontrol model"
			>
				{[
					{
						active: doorsOpen,
						toggle: setDoorsOpen,
						label: hasDrawers
							? hasDoors
								? "Buka pintu dan laci"
								: "Buka laci"
							: "Buka pintu",
						Icon: DoorOpen,
						disabled: !hasDoors && !hasDrawers,
					},
					{
						active: hideDoors,
						toggle: setHideDoors,
						label: "Sembunyikan pintu",
						Icon: DoorClosed,
						disabled: !hasDoors,
					},
					{ active: xray, toggle: setXray, label: "X-ray", Icon: EyeOff },
					{
						active: numbers,
						toggle: setNumbers,
						label: "Nomor panel",
						Icon: Hash,
					},
				].map(({ active, toggle, label, Icon, disabled }) => (
					<Button
						key={label}
						type="button"
						variant={active ? "secondary" : "ghost"}
						size="icon"
						aria-label={label}
						title={label}
						aria-pressed={active}
						disabled={disabled}
						onClick={() => toggle((value) => !value)}
					>
						<Icon aria-hidden="true" />
					</Button>
				))}
			</div>
			{missingHinges > 0 && dismissedHingesRoom !== room && (
				<div
					role="status"
					className={`absolute left-3 ${hideRoomSelector ? "top-16" : "top-32"} flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-amber-300 bg-amber-50 py-1 pl-3 pr-1 text-xs text-amber-800 shadow-sm sm:left-5`}
				>
					<TriangleAlert className="size-4" aria-hidden="true" />
					<span>{missingHinges} pintu tanpa engsel, periksa kembali</span>
					<button
						type="button"
						aria-label="Tutup peringatan engsel"
						className="flex size-7 items-center justify-center"
						onClick={() => setDismissedHingesRoom(room)}
					>
						<X className="size-4" />
					</button>
				</div>
			)}
			<div
				className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[45%] overflow-y-auto rounded-xl border bg-card/95 shadow-sm ${hideRoomSelector ? "p-2" : "p-3 sm:left-5 sm:right-auto sm:w-96"}`}
			>
				{hingeCheckUnavailable && (
					<p role="status" className="mb-2 text-xs text-muted-foreground">
						Data engsel belum dapat dipastikan. Periksa model sumber atau import
						ulang model.
					</p>
				)}
				{unresolvedDoors > 0 && (
					<p role="status" className="mb-2 text-xs text-amber-700">
						{unresolvedDoors} pintu tidak dianimasikan karena arah bukanya belum
						dapat dipastikan.
					</p>
				)}
				{locationViewer && selectedId && (
					<div className="mb-1 flex min-w-0 items-center gap-2">
						<strong className="text-sm">
							{(pickedPanel?.room === room ? pickedPanel.number : initialNumber)
								? `Panel ${pickedPanel?.room === room ? pickedPanel.number : initialNumber}`
								: "Panel dipilih"}
						</strong>
						<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
							{selectedHpl?.serial ||
								(pickedPanel?.room === room && pickedPanel.id !== selectedPanel
									? ""
									: initialSerial)}
						</span>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="size-10 shrink-0 rounded-xl"
							aria-label={
								detailsOpen ? "Tutup detail panel" : "Buka detail panel"
							}
							aria-expanded={detailsOpen}
							aria-controls="panel-viewer-details"
							onClick={() => setDetailsOpen((open) => !open)}
						>
							{detailsOpen ? <ChevronDown /> : <ChevronUp />}
						</Button>
					</div>
				)}
				<div className="flex items-center gap-3">
					<span className="text-sm font-semibold">Explode</span>
					<Slider
						aria-label="Explode"
						value={explode}
						onValueChange={setExplode}
						className="min-w-0 flex-1"
					/>
					<output className="text-sm">{explode}%</output>
				</div>
				{locationViewer && trialRevision && selectedId && detailsOpen && (
					<section
						id="panel-viewer-details"
						aria-label="Kode HPL"
						className="mt-3 space-y-3 border-t pt-3 text-xs"
					>
						{selectedHpl && (
							<>
								{["matched", "partial", "missing_hpl"].includes(
									selectedHpl.status,
								) ? (
									<>
										<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 leading-5">
											<dt className="text-muted-foreground">HPL sisi 1</dt>
											<dd className="wrap-break-word font-semibold">
												{selectedHpl.side1 ?? "Belum diisi di BOM"}
											</dd>
											<dt className="text-muted-foreground">HPL sisi 2</dt>
											<dd className="wrap-break-word font-semibold">
												{selectedHpl.side2 ?? "Belum diisi di BOM"}
											</dd>
										</dl>
										<p className="leading-5 text-muted-foreground">
											Dicocokkan berdasarkan serial
										</p>
									</>
								) : (
									<p>
										{selectedHpl.status === "ambiguous"
											? "Serial ambigu atau bukan task paling bawah."
											: selectedHpl.status === "conflict"
												? "Kode panel dan parent berbeda; perlu diperiksa."
												: selectedHpl.status === "missing_parent"
													? "Parent BOM tidak ditemukan."
													: selectedHpl.status === "missing_production_serial"
														? "Serial produksi tidak tersedia."
														: "Serial tidak ditemukan di ClickUp."}
									</p>
								)}
							</>
						)}
						<p role="status" className="leading-5 text-muted-foreground">
							{hplState === "loading"
								? "Memuat kode HPL…"
								: hplState === "login"
									? "Login untuk memperbarui kode HPL."
								: hplState === "denied"
									? "Refresh hanya tersedia untuk pengguna yang memiliki izin import model."
									: hplState === "error"
									? `Kode HPL gagal diperbarui.${selectedHpl ? ` Data lama dari ${new Date(selectedHpl.syncedAt).toLocaleString("id-ID")}.` : ""}`
										: selectedHpl && hpl
											? `Diperbarui: ${new Date(selectedHpl.syncedAt).toLocaleString("id-ID")}`
												: "HPL belum disinkronkan untuk panel ini."}
						</p>
						<div className="flex flex-wrap gap-2">
							{selectedHpl?.source &&
								["matched", "partial", "missing_hpl"].includes(
									selectedHpl.status,
								) && (
									<a
										href={selectedHpl.source}
										target="_blank"
										rel="noreferrer"
										className="inline-flex min-h-9 items-center rounded-full bg-muted px-3 font-medium"
									>
										Sumber ClickUp
									</a>
								)}
							<button
								type="button"
								className="min-h-9 rounded-full bg-muted px-3 font-medium disabled:opacity-50"
								onClick={() => loadHpl("panel")}
								disabled={hplState === "loading"}
							>
								Refresh kode HPL
							</button>
						</div>
					</section>
				)}
				{footer &&
					(!locationViewer || detailsOpen) &&
					!(pickedPanel?.room === room && pickedPanel.id !== selectedPanel) && (
						<div
							className={
								locationViewer
									? "mt-2"
									: hideRoomSelector
										? "mt-1 border-t pt-2"
										: "mt-3 border-t pt-3"
							}
						>
							{footer}
						</div>
					)}
			</div>
		</section>
	);
}
