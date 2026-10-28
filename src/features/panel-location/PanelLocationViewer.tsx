"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	MapPin,
	RotateCcw,
	Plus,
	Minus,
	Expand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { projectPanelLocations } from "@/lib/panelLocation";
import type { PanelLocationView } from "@/types/panelLocation";

const FACES = [
	[0, 1, 2, 3],
	[4, 5, 6, 7],
	[0, 1, 5, 4],
	[1, 2, 6, 5],
	[2, 3, 7, 6],
	[3, 0, 4, 7],
];
const INITIAL_YAW = -0.65;
const INITIAL_PITCH = 0.35;

export function PanelLocationViewer({
	projectName,
	version,
	barcode,
	panels,
	immersive = false,
}: PanelLocationView & { immersive?: boolean }) {
	const [yaw, setYaw] = useState(INITIAL_YAW);
	const [pitch, setPitch] = useState(INITIAL_PITCH);
	const [zoom, setZoom] = useState(1);
	const [explode, setExplode] = useState(0);
	const [aspect, setAspect] = useState(1);
	const viewport = useRef<SVGSVGElement>(null);
	const drag = useRef<{ x: number; y: number } | null>(null);
	useEffect(() => {
		const element = viewport.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.height > 0)
				setAspect(entry.contentRect.width / entry.contentRect.height);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	const selected = panels.find((panel) => panel.barcode === barcode);
	const panelLabel = selected?.panelNumber
		? `Panel ${selected.panelNumber}`
		: "Panel";
	const projected = useMemo(
		() => (panels.length ? projectPanelLocations(panels, yaw, pitch) : []),
		[panels, yaw, pitch],
	);
	// Fit both endpoints so changing explode progress does not move the camera.
	const points = useMemo(
		() =>
			projected.flatMap((panel) =>
				panel.points.flatMap((point) => [
					point,
					point.map((value, axis) => value + panel.explodeOffset[axis]),
				]),
			),
		[projected],
	);
	const xs = points.map((point) => point[0]),
		ys = points.map((point) => point[1]);
	const minX = Math.min(...xs),
		maxX = Math.max(...xs),
		minY = Math.min(...ys),
		maxY = Math.max(...ys);
	const width = Math.max(maxX - minX, (maxY - minY) * aspect, 1) * 1.3 * zoom;
	const height = width / aspect;
	const faces = useMemo(() => projected
		.flatMap((panel) =>
			FACES.map((face, index) => ({
				barcode: panel.barcode,
				offset: panel.explodeOffset,
				key: `${panel.barcode}:${index}`,
				points: face.map((corner) => `${panel.points[corner][0]},${panel.points[corner][1]}`).join(" "),
				depth:
					face.reduce((sum, corner) => sum + panel.points[corner][2], 0) / 4,
			})),
		)
		.sort((a, b) => b.depth - a.depth), [projected]);
	const rotateUp = (delta: number) =>
		setPitch((value) => Math.max(-1.2, Math.min(1.2, value + delta)));
	const reset = () => {
		setYaw(INITIAL_YAW);
		setPitch(INITIAL_PITCH);
		setZoom(1);
		setExplode(0);
	};
	const drawFaces = (active: boolean) =>
		faces
			.filter((face) => (face.barcode === barcode) === active)
			.map((face) => (
				<polygon
					key={face.key}
					style={{
						transform: `translate(${face.offset[0] * explode}px, ${face.offset[1] * explode}px)`,
					}}
					className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
					points={face.points}
					fill={active ? "#ef4444" : "#94a3b8"}
					fillOpacity={active ? 0.78 : 0.12}
					stroke={active ? "#be123c" : "#64748b"}
					strokeOpacity={active ? 1 : 0.4}
					strokeWidth={active ? 1.8 : 0.7}
					vectorEffect="non-scaling-stroke"
				/>
			));

	return (
		<section
			aria-label="Lokasi panel"
			className={
				immersive
					? "relative min-h-0 flex-1 overflow-hidden"
					: "flex flex-col gap-4"
			}
		>
			{!immersive && (
				<header className="flex items-start justify-between gap-4">
					<div>
						<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
							Posisi panel
						</p>
						<h1 className="mt-1 text-xl font-black sm:text-2xl">
							{projectName}
						</h1>
					</div>
					<MapPin
						aria-hidden="true"
						className="mt-1 size-6 shrink-0 text-red-600"
					/>
				</header>
			)}

			{selected ? (
				<>
					<section
						className={
							immersive
								? "sr-only"
								: "flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3"
						}
						aria-label="Panel terpilih"
					>
						<div>
							<p className="text-sm font-bold text-red-700">
								{panelLabel} · {barcode}
							</p>
							<p className="text-sm text-muted-foreground">
								{selected.roomName}
							</p>
						</div>
						<p className="text-xs text-muted-foreground">
							<span className="mr-1.5 inline-block size-2 rounded-full bg-red-500" />
							Merah = panel yang dicari
						</p>
					</section>
					<div
						className={
							immersive
								? "relative h-full min-h-0 bg-neutral-50 dark:bg-background"
								: "overflow-hidden rounded-2xl border bg-slate-50"
						}
					>
						<svg
							ref={viewport}
							viewBox={`${(minX + maxX - width) / 2} ${(minY + maxY - height) / 2} ${width} ${height}`}
							className={`${immersive ? "h-full" : "h-[min(62dvh,640px)] min-h-80"} w-full cursor-grab select-none text-foreground active:cursor-grabbing`}
							style={{ touchAction: "none" }}
							role="img"
							tabIndex={0}
							aria-label={`Posisi ${panelLabel.toLowerCase()}, barcode ${barcode}, ruang ${selected.roomName}. Gunakan tombol panah untuk memutar.`}
							data-selected-barcode={barcode}
							data-panel-count={panels.length}
							data-explode={Math.round(explode * 100)}
							onPointerDown={(event) => {
								if (event.button !== 0) return;
								drag.current = { x: event.clientX, y: event.clientY };
								event.currentTarget.setPointerCapture(event.pointerId);
							}}
							onPointerMove={(event) => {
								if (!drag.current) return;
								const dx = event.clientX - drag.current.x,
									dy = event.clientY - drag.current.y;
								setYaw((value) => value + dx * 0.008);
								rotateUp(dy * 0.008);
								drag.current = { x: event.clientX, y: event.clientY };
							}}
							onPointerUp={() => {
								drag.current = null;
							}}
							onPointerCancel={() => {
								drag.current = null;
							}}
							onLostPointerCapture={() => {
								drag.current = null;
							}}
							onKeyDown={(event) => {
								if (
									!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
										event.key,
									)
								)
									return;
								event.preventDefault();
								if (event.key === "ArrowLeft") setYaw((value) => value - 0.2);
								if (event.key === "ArrowRight") setYaw((value) => value + 0.2);
								if (event.key === "ArrowUp") rotateUp(-0.2);
								if (event.key === "ArrowDown") rotateUp(0.2);
							}}
						>
							<title>{`${panelLabel} di ruang ${selected.roomName}`}</title>
							{drawFaces(false)}
							{/* Keep the target visible through surrounding panels, including panels at the back. */}
							{drawFaces(true)}
						</svg>
						<div
							className={
								immersive
									? "absolute right-3 top-1/2 flex max-h-[calc(100%-10rem)] -translate-y-1/2 flex-col gap-0.5 overflow-y-auto rounded-full border border-border/50 bg-card/95 p-1.5 shadow-lg"
									: "flex flex-wrap items-center justify-center gap-1 border-t bg-background p-2"
							}
							aria-label="Kontrol tampilan"
						>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Putar kiri"
								onClick={() => setYaw((v) => v - 0.3)}
							>
								<ArrowLeft />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Putar kanan"
								onClick={() => setYaw((v) => v + 0.3)}
							>
								<ArrowRight />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Putar atas"
								onClick={() => rotateUp(-0.3)}
							>
								<ArrowUp />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Putar bawah"
								onClick={() => rotateUp(0.3)}
							>
								<ArrowDown />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Perbesar"
								onClick={() => setZoom((v) => Math.max(0.25, v * 0.8))}
							>
								<Plus />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Perkecil"
								onClick={() => setZoom((v) => Math.min(3, v / 0.8))}
							>
								<Minus />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Reset tampilan"
								onClick={reset}
							>
								<RotateCcw />
							</Button>
						</div>
						<div
							className={
								immersive
									? "absolute inset-x-3 bottom-3 space-y-2"
									: "border-t bg-background p-2"
							}
						>
							{immersive && (
								<p className="inline-flex items-center gap-2 rounded-full bg-card/95 px-3 py-2 text-[11px] font-semibold shadow-sm">
									<span
										aria-hidden="true"
										className="size-2.5 rounded-full bg-red-500 ring-2 ring-red-500/20"
									/>
									Panel yang dicari
								</p>
							)}
							<div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/95 p-2 shadow-sm">
								<Button
									variant="ghost"
									size="sm"
									className="min-h-10"
									aria-label="Explode panel"
									aria-pressed={explode > 0}
									onClick={() => setExplode(explode > 0 ? 0 : 1)}
								>
									<Expand aria-hidden="true" />
									Explode
								</Button>
								<label className="sr-only" htmlFor={`explode-${barcode}`}>
									Jarak explode
								</label>
								<input
									id={`explode-${barcode}`}
									type="range"
									min={0}
									max={100}
									step={1}
									value={Math.round(explode * 100)}
									onChange={(event) =>
										setExplode(Number(event.target.value) / 100)
									}
									className="h-10 min-w-0 flex-1 cursor-pointer accent-primary"
								/>
								<output
									htmlFor={`explode-${barcode}`}
									className="w-10 text-right text-xs font-semibold tabular-nums"
								>
									{Math.round(explode * 100)}%
								</output>
							</div>
						</div>
					</div>
					{!immersive && (
						<p className="text-center text-xs text-muted-foreground">
							Geser untuk memutar · Bentuk disederhanakan untuk panduan posisi
						</p>
					)}
				</>
			) : (
				<p
					role="status"
					className={`rounded-xl border bg-muted p-5 text-sm ${immersive ? "mx-3 mt-20" : ""}`}
				>
					{barcode
						? "Barcode tidak ditemukan pada model project ini. Periksa barcode dan project."
						: "Masukkan barcode untuk melihat posisi panel."}
				</p>
			)}
			<footer
				className={
					immersive
						? "sr-only"
						: "mt-auto text-center text-xs text-muted-foreground"
				}
			>
				Snapshot {version}
			</footer>
		</section>
	);
}
