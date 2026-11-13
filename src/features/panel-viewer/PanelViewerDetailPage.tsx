"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
	DoorOpen,
	EyeOff,
	ScanEye,
	Hash,
	Bone,
	DoorClosed,
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

export function PanelViewerDetailPage({
	id,
	rooms,
	initialRoom,
	selectedPanel,
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
	trialRevision?: string;
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
			room === initialRoom ? selectedPanel : undefined,
		);
	}, [room, initialRoom, selectedPanel]);
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
			<div
				className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[45%] overflow-y-auto rounded-xl border bg-card/95 shadow-sm ${hideRoomSelector ? "p-2" : "p-3 sm:left-5 sm:right-auto sm:w-96"}`}
			>
				{missingHinges > 0 && (
					<p role="status" className="mb-2 text-xs text-amber-700">
						{missingHinges} pintu belum memiliki engsel dalam data desain
						(ditandai kuning; panel terpilih tetap merah). Tanyakan Tim.
					</p>
				)}
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
				{footer && (
					<div
						className={
							hideRoomSelector ? "mt-1 border-t pt-2" : "mt-3 border-t pt-3"
						}
					>
						{footer}
					</div>
				)}
			</div>
		</section>
	);
}
