"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RotateCcw, Eye, EyeOff, DoorOpen, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	isDoorPanel,
	panelLocationUrl,
	projectPanelLocations,
} from "@/lib/panelLocation";
import type { PanelLocationView } from "@/types/panelLocation";

const INITIAL_YAW = -0.65;
const INITIAL_PITCH = -0.25;

export function PanelLocationViewer({
	projectId,
	projectName,
	version,
	versionNumber,
	barcode,
	panels,
	immersive = false,
	preview = false,
	desktopLayout = false,
}: PanelLocationView & {
	immersive?: boolean;
	preview?: boolean;
	desktopLayout?: boolean;
}) {
	const activeVersion = useQuery({
		queryKey: ["panel-location-version", projectId],
		queryFn: async ({ signal }) => {
			const response = await fetch(
				`/api/panel/location-version?${new URLSearchParams({ project: projectId })}`,
				{ cache: "no-store", signal },
			);
			if (!response.ok) throw new Error("LOCATION_UNAVAILABLE");
			const result = (await response.json()) as {
				active?: Pick<PanelLocationView, "version" | "versionNumber"> | null;
			};
			if (
				result.active !== null &&
				(typeof result.active?.version !== "string" ||
					!Number.isInteger(result.active.versionNumber))
			)
				throw new Error("INVALID_RESPONSE");
			return result.active;
		},
		enabled: Boolean(projectId && panels.length),
		staleTime: 0,
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: "always",
		refetchOnReconnect: "always",
		retry: 1,
	});
	const outdated =
		activeVersion.isFetchedAfterMount &&
		activeVersion.data !== undefined &&
		(activeVersion.data?.version !== version ||
			activeVersion.data?.versionNumber !== versionNumber);
	const [yaw, setYaw] = useState(INITIAL_YAW);
	const [pitch, setPitch] = useState(INITIAL_PITCH);
	const [zoom, setZoom] = useState(1);
	const [explode, setExplode] = useState(0);
	const [animateExplode, setAnimateExplode] = useState(false);
	const [hideDoors, setHideDoors] = useState(false);
	const [doorsOpen, setDoorsOpen] = useState(false);
	const [doorProgress, setDoorProgress] = useState(0);
	const currentDoorProgress = useRef(0);
	const doorFrame = useRef<number | null>(null);
	const [aspect, setAspect] = useState(1);
	const viewport = useRef<SVGSVGElement>(null);
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const changeZoom = (factor: number) =>
		setZoom((value) => Math.max(0.25, Math.min(3, value * factor)));
	useEffect(() => {
		const target = doorsOpen ? 1 : 0;
		const from = currentDoorProgress.current;
		if (from === target) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			currentDoorProgress.current = target;
			setDoorProgress(target);
			return;
		}
		const started = performance.now();
		const step = (now: number) => {
			const elapsed = Math.min(1, (now - started) / 450);
			const eased = elapsed * elapsed * (3 - 2 * elapsed);
			currentDoorProgress.current = from + (target - from) * eased;
			setDoorProgress(currentDoorProgress.current);
			doorFrame.current = elapsed < 1 ? requestAnimationFrame(step) : null;
		};
		doorFrame.current = requestAnimationFrame(step);
		return () => {
			if (doorFrame.current !== null) cancelAnimationFrame(doorFrame.current);
			doorFrame.current = null;
		};
	}, [doorsOpen]);
	useEffect(() => {
		const element = viewport.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.height > 0)
				setAspect(entry.contentRect.width / entry.contentRect.height);
		});
		observer.observe(element);
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			changeZoom(Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.004));
		};
		element.addEventListener("wheel", wheel, { passive: false });
		return () => {
			observer.disconnect();
			element.removeEventListener("wheel", wheel);
		};
	}, []);
	const selected = panels.find((panel) => panel.barcode === barcode);
	const panelLabel = selected?.panelNumber
		? `Panel ${selected.panelNumber}`
		: "Panel";
	const fitted = useMemo(
		() =>
			panels.length ? projectPanelLocations(panels, yaw, pitch, barcode) : [],
		[panels, yaw, pitch, barcode],
	);
	const projected = useMemo(
		() =>
			doorProgress === 0
				? fitted
				: projectPanelLocations(panels, yaw, pitch, barcode, doorProgress),
		[fitted, panels, yaw, pitch, barcode, doorProgress],
	);
	// Fit both endpoints so changing explode progress does not move the camera.
	const points = useMemo(
		() =>
			fitted.flatMap((panel) =>
				panel.fitPoints.flatMap((point) => [
					point,
					point.map((value, axis) => value + panel.explodeOffset[axis]),
				]),
			),
		[fitted],
	);
	const [minX, maxX, minY, maxY] = useMemo(() => {
		const xs = points.map((point) => point[0]),
			ys = points.map((point) => point[1]);
		return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	}, [points]);
	const width = Math.max(maxX - minX, (maxY - minY) * aspect, 1) * 1.15 * zoom;
	const height = width / aspect;
	const shapes = useMemo(
		() =>
			projected
				.map((panel) => {
					// shortcut: translucent panels share one fill path; use a depth buffer for opaque CAD rendering.
					const faces = panel.faceIndices.map((face) => {
						const points = face.map((corner) => panel.points[corner]);
						// Matching winding keeps the combined path filled where front and back faces overlap.
						const area = points.reduce(
							(sum, point, index) =>
								sum +
								point[0] * points[(index + 1) % points.length][1] -
								point[1] * points[(index + 1) % points.length][0],
							0,
						);
						if (area < 0) points.reverse();
						return points.map((point) => `${point[0]},${point[1]}`).join(" ");
					});
					return {
						...panel,
						faces,
						path: faces.map((points) => `M${points}Z`).join(" "),
						edges: panel.edgeIndices
							.map(
								(edge) =>
									`M${edge.map((index) => `${panel.points[index][0]},${panel.points[index][1]}`).join("L")}`,
							)
							.join(" "),
						depth:
							panel.points.reduce((sum, point) => sum + point[2], 0) /
							panel.points.length,
					};
				})
				.sort((a, b) => b.depth - a.depth),
		[projected],
	);
	const target = shapes.find((panel) => panel.barcode === barcode);
	const targetCenter =
		target &&
		[0, 1].map(
			(axis) =>
				target.points.reduce((sum, point) => sum + point[axis], 0) /
				target.points.length,
		);
	const doorCount = panels.filter(
		(panel) => isDoorPanel(panel) && panel.barcode !== barcode,
	).length;
	const animatedDoorCount = panels.filter((panel) => panel.doorOpenType).length;
	const rotateUp = (delta: number) =>
		setPitch((value) => Math.max(-1.2, Math.min(1.2, value + delta)));
	const reset = () => {
		setAnimateExplode(false);
		setYaw(INITIAL_YAW);
		setPitch(INITIAL_PITCH);
		setZoom(1);
		setExplode(0);
		setHideDoors(false);
		setDoorsOpen(false);
		if (doorFrame.current !== null) cancelAnimationFrame(doorFrame.current);
		doorFrame.current = null;
		currentDoorProgress.current = 0;
		setDoorProgress(0);
	};
	const drawPanels = (active: boolean) =>
		shapes
			.filter(
				(panel) =>
					(panel.barcode === barcode) === active &&
					(active || !hideDoors || !isDoorPanel(panel)),
			)
			.map((panel) => (
				<g
					key={panel.barcode}
					data-barcode={panel.barcode}
					style={{
						transform: `translate(${panel.explodeOffset[0] * explode}px, ${panel.explodeOffset[1] * explode}px)`,
					}}
					className={
						animateExplode
							? "motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
							: undefined
					}
					fill={active ? "#ef4444" : "#a1a1aa"}
					fillOpacity={active ? 0.78 : 0.14}
					stroke={active ? "#be123c" : "#52525b"}
					strokeOpacity={active ? 1 : 0.55}
					strokeWidth={active ? 1.8 : 0.7}
				>
					{panel.geometry ? (
						<>
							<path d={panel.path} stroke="none" />
							<path
								d={panel.edges}
								fill="none"
								vectorEffect="non-scaling-stroke"
							/>
						</>
					) : active ? (
						panel.faces.map((points, index) => (
							<polygon
								key={index}
								points={points}
								fill="#ef4444"
								vectorEffect="non-scaling-stroke"
							/>
						))
					) : (
						<path d={panel.path} vectorEffect="non-scaling-stroke" />
					)}
				</g>
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
			<div
				className={
					immersive
						? `absolute inset-x-3 top-16 z-10 space-y-2 ${desktopLayout ? "md:left-6 md:top-20 md:max-w-lg" : ""}`
						: "space-y-2"
				}
			>
				{(immersive || preview) && (
					<p
						role={preview ? "status" : undefined}
						className={`w-fit rounded-full px-3 py-1 text-[11px] ${preview ? "border border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-card/95 text-muted-foreground"}`}
					>
						{preview ? "Preview versi" : "Versi tampilan"} V{versionNumber}
					</p>
				)}
				{outdated && (
					<Alert className="border border-amber-500/40 bg-card text-amber-900 dark:text-amber-200">
						<AlertDescription className="text-inherit">
							{activeVersion.data === null
								? "Model ini belum memiliki versi aktif."
								: `Tampilan ini memakai V${versionNumber}. Versi aktif sekarang V${activeVersion.data?.versionNumber}.`}
						</AlertDescription>
						{activeVersion.data !== null && (
							<Button
								size="sm"
								variant="outline"
								className="mt-2 w-fit"
								onClick={() => {
									if (preview)
										window.location.assign(
											panelLocationUrl(projectId, barcode),
										);
									else window.location.reload();
								}}
							>
								Muat versi aktif
							</Button>
						)}
					</Alert>
				)}
				{(activeVersion.isError || activeVersion.fetchStatus === "paused") && (
					<Alert className="border border-amber-500/40 bg-card text-amber-900 dark:text-amber-200">
						<AlertDescription className="text-inherit">
							Versi aktif belum dapat diperiksa.
						</AlertDescription>
						<Button
							size="sm"
							variant="outline"
							className="mt-2 w-fit"
							onClick={() => void activeVersion.refetch()}
						>
							Periksa lagi
						</Button>
					</Alert>
				)}
			</div>

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
							aria-label={`Posisi ${panelLabel.toLowerCase()}, barcode ${barcode}, ruang ${selected.roomName}. Geser atau tombol panah untuk memutar. Scroll, pinch, atau tombol plus dan minus untuk zoom.`}
							data-selected-barcode={barcode}
							data-panel-count={panels.length}
							data-explode={Math.round(explode * 100)}
							data-doors-hidden={hideDoors}
							data-doors-open={doorsOpen}
							data-door-progress={Math.round(doorProgress * 100)}
							onPointerDown={(event) => {
								if (event.button !== 0) return;
								setAnimateExplode(false);
								pointers.current.set(event.pointerId, {
									x: event.clientX,
									y: event.clientY,
								});
								event.currentTarget.setPointerCapture(event.pointerId);
							}}
							onPointerMove={(event) => {
								const previous = pointers.current.get(event.pointerId);
								if (!previous) return;
								const other = [...pointers.current.entries()].find(
									([id]) => id !== event.pointerId,
								)?.[1];
								if (pointers.current.size === 2 && other) {
									const before = Math.hypot(
										previous.x - other.x,
										previous.y - other.y,
									);
									const after = Math.hypot(
										event.clientX - other.x,
										event.clientY - other.y,
									);
									if (before > 0 && after > 0) changeZoom(before / after);
								} else if (pointers.current.size === 1) {
									setYaw(
										(value) => value + (event.clientX - previous.x) * 0.008,
									);
									rotateUp((event.clientY - previous.y) * 0.008);
								}
								pointers.current.set(event.pointerId, {
									x: event.clientX,
									y: event.clientY,
								});
							}}
							onPointerUp={(event) => {
								pointers.current.delete(event.pointerId);
							}}
							onPointerCancel={(event) => {
								pointers.current.delete(event.pointerId);
							}}
							onLostPointerCapture={(event) => {
								pointers.current.delete(event.pointerId);
							}}
							onKeyDown={(event) => {
								if (
									![
										"ArrowLeft",
										"ArrowRight",
										"ArrowUp",
										"ArrowDown",
										"+",
										"=",
										"-",
									].includes(event.key)
								)
									return;
								event.preventDefault();
								setAnimateExplode(false);
								if (event.key === "+" || event.key === "=") changeZoom(0.8);
								if (event.key === "-") changeZoom(1 / 0.8);
								if (event.key === "ArrowLeft") setYaw((value) => value - 0.2);
								if (event.key === "ArrowRight") setYaw((value) => value + 0.2);
								if (event.key === "ArrowUp") rotateUp(-0.2);
								if (event.key === "ArrowDown") rotateUp(0.2);
							}}
						>
							<title>{`${panelLabel} di ruang ${selected.roomName}`}</title>
							{drawPanels(false)}
							{explode > 0 && target && targetCenter && (
								<g
									fill="none"
									stroke="#be123c"
									strokeDasharray="5 4"
									opacity={0.6}
									aria-hidden="true"
								>
									<path
										d={target.geometry ? target.edges : target.path}
										vectorEffect="non-scaling-stroke"
									/>
									<line
										x1={targetCenter[0]}
										y1={targetCenter[1]}
										x2={targetCenter[0] + target.explodeOffset[0] * explode}
										y2={targetCenter[1] + target.explodeOffset[1] * explode}
										vectorEffect="non-scaling-stroke"
									/>
								</g>
							)}
							{/* Keep the target visible through surrounding panels, including panels at the back. */}
							{drawPanels(true)}
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
								aria-label="Buka/tutup pintu"
								aria-pressed={doorsOpen}
								disabled={animatedDoorCount === 0}
								title={
									animatedDoorCount === 0
										? "Arah buka pintu belum tersedia"
										: doorsOpen
											? "Tutup pintu"
											: "Buka pintu"
								}
								onClick={() => {
									setAnimateExplode(false);
									setHideDoors(false);
									setDoorsOpen((value) => !value);
								}}
							>
								<DoorOpen aria-hidden="true" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Sembunyikan pintu"
								aria-pressed={hideDoors}
								disabled={doorCount === 0}
								title={
									doorCount === 0
										? "Tidak ada pintu lain yang teridentifikasi pada ruang ini"
										: hideDoors
											? "Tampilkan pintu"
											: "Sembunyikan pintu"
								}
								onClick={() => setHideDoors((value) => !value)}
							>
								{hideDoors ? (
									<Eye aria-hidden="true" />
								) : (
									<EyeOff aria-hidden="true" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Reset tampilan"
								title="Reset tampilan"
								onClick={reset}
							>
								<RotateCcw />
							</Button>
						</div>
						<div
							className={
								immersive
									? `absolute inset-x-3 bottom-3 space-y-2 ${desktopLayout ? "md:left-auto md:right-6 md:bottom-6 md:w-96" : ""}`
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
									className="min-h-10 w-24 shrink-0"
									aria-label="Explode panel"
									aria-pressed={explode > 0}
									onClick={() => {
										setAnimateExplode(true);
										setExplode(explode > 0 ? 0 : 1);
									}}
								>
									<Expand aria-hidden="true" />
									{explode > 0 ? "Pasang" : "Tarik"}
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
									onChange={(event) => {
										setAnimateExplode(false);
										setExplode(Number(event.target.value) / 100);
									}}
									className="h-10 min-w-0 flex-1 cursor-pointer accent-primary"
								/>
								<output
									htmlFor={`explode-${barcode}`}
									className="w-10 text-right text-xs font-semibold tabular-nums"
								>
									{Math.round(explode * 100)}%
								</output>
							</div>
							<p className="text-center text-[11px] text-muted-foreground">
								Tarik panel merah dari posisinya · Scroll / pinch untuk zoom
							</p>
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
			{!immersive && !preview && (
				<footer className="mt-auto text-center text-xs text-muted-foreground">
					Versi tampilan V{versionNumber}
				</footer>
			)}
		</section>
	);
}
