"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RotateCcw, Eye, EyeOff, DoorOpen, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	isDoorPanel,
	panelLocationUrl,
	projectPanelLocations,
} from "@/lib/panelLocation";
import type { PanelLocationView } from "@/types/panelLocation";
import { PanelLocation3D } from "./PanelLocation3D";
import { layoutPanelNumbers } from "@/lib/panelNumberLabels";

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
	embedded = false,
}: PanelLocationView & {
	immersive?: boolean;
	preview?: boolean;
	desktopLayout?: boolean;
	embedded?: boolean;
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
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [explode, setExplode] = useState(0);
	const [hideDoors, setHideDoors] = useState(false);
	const [showNumbers, setShowNumbers] = useState(false);
	const [doorsOpen, setDoorsOpen] = useState(false);
	const [doorProgress, setDoorProgress] = useState(0);
	const currentDoorProgress = useRef(0);
	const doorFrame = useRef<number | null>(null);
	const [aspect, setAspect] = useState(1);
	const [viewportWidth, setViewportWidth] = useState(0);
	const [webglFailed, setWebglFailed] = useState(false);
	const handleWebglFailure = useCallback(() => setWebglFailed(true), []);
	const viewport = useRef<SVGSVGElement>(null);
	const pointers = useRef(new Map<number, { x: number; y: number; button: number }>());
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
			if (entry.contentRect.height > 0) {
				setAspect(entry.contentRect.width / entry.contentRect.height);
				setViewportWidth(entry.contentRect.width);
			}
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
			panels.length ? projectPanelLocations(panels, yaw, pitch, barcode, 0, true) : [],
		[panels, yaw, pitch, barcode],
	);
	const projected = useMemo(
		() =>
			doorProgress === 0
				? fitted
				: projectPanelLocations(panels, yaw, pitch, barcode, doorProgress, true),
		[fitted, panels, yaw, pitch, barcode, doorProgress],
	);
	const sceneRadius = useMemo(() => {
		const vertices = panels.flatMap((panel) => [...(panel.geometry?.vertices ?? panel.corners), ...(panel.hinges ?? []).flatMap((hinge) => hinge.geometry.vertices)]);
		if (!vertices.length) return 1;
		const center = [0, 1, 2].map((axis) => (Math.min(...panels.flatMap((panel) => (panel.geometry?.vertices ?? panel.corners).map((point) => point[axis]))) + Math.max(...panels.flatMap((panel) => (panel.geometry?.vertices ?? panel.corners).map((point) => point[axis])))) / 2);
		return Math.max(1, ...vertices.map((point) => Math.hypot(...point.map((value, axis) => value - center[axis]))));
	}, [panels]);
	const width = Math.max(sceneRadius * 3, sceneRadius * 3 * aspect, 1) * zoom;
	const height = width / aspect;
	const numberScale = width / (viewportWidth || 320);
	const numberLabels = useMemo(() => showNumbers && webglFailed ? layoutPanelNumbers(
		projected.filter((panel) => panel.panelNumberVerified && panel.panelNumber && (panel.barcode === barcode || !hideDoors || !isDoorPanel(panel)))
			.map((panel) => ({ barcode: panel.barcode, number: panel.panelNumber, x: panel.points.reduce((sum, point) => sum + point[0], 0) / panel.points.length + panel.explodeOffset[0] * explode, y: panel.points.reduce((sum, point) => sum + point[1], 0) / panel.points.length + panel.explodeOffset[1] * explode }))
			.sort((a, b) => Number(b.barcode === barcode) - Number(a.barcode === barcode)),
		numberScale, { left: -width / 2 - pan.x, right: width / 2 - pan.x, top: -height / 2 - pan.y, bottom: height / 2 - pan.y },
	) : [], [showNumbers, webglFailed, projected, barcode, hideDoors, explode, numberScale, width, height, pan]);
	const shapes = useMemo(
		() =>
			!webglFailed ? [] : projected
				.map((panel) => {
					// shortcut: translucent panels share one fill path; use a depth buffer for opaque CAD rendering.
					const facePaths = (indices: number[][], vertices: number[][]) => indices.map((face) => {
						const points = face.map((corner) => vertices[corner]);
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
					const faces = facePaths(panel.faceIndices, panel.points);
					return {
						...panel,
						hinges: panel.hinges.map((hinge) => ({
							...hinge,
							path: facePaths(hinge.geometry.faces, hinge.points).map((points) => `M${points}Z`).join(" "),
						})),
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
		[projected, webglFailed],
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
		setYaw(INITIAL_YAW);
		setPitch(INITIAL_PITCH);
		setZoom(1);
		setPan({ x: 0, y: 0 });
		setExplode(0);
		setHideDoors(false);
		setShowNumbers(false);
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
					{panel.hinges.map((hinge) => (
						<path
							key={hinge.id}
							data-hinge-id={hinge.id}
							d={hinge.path}
							fill="#64748b"
							fillOpacity={0.9}
							fillRule="nonzero"
							stroke="none"
						>
							<title>{`${hinge.name}${hinge.code ? ` · ${hinge.code}` : ""}`}</title>
						</path>
					))}
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
						? `pointer-events-none absolute inset-x-3 ${embedded && preview ? "top-28" : embedded ? "top-3" : "top-16"} z-10 space-y-2 ${desktopLayout ? `md:left-6 ${embedded && preview ? "md:top-28" : embedded ? "md:top-4" : "md:top-20"} md:max-w-lg` : ""}`
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
					<Alert className="pointer-events-auto border border-amber-500/40 bg-card text-amber-900 dark:text-amber-200">
						<AlertDescription className="text-inherit">
							{activeVersion.data === null
								? "Model ini belum memiliki versi aktif."
								: `Tampilan ini memakai V${versionNumber}. Versi aktif sekarang V${activeVersion.data?.versionNumber}.`}
						</AlertDescription>
						{activeVersion.data !== null && !embedded && (
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
					<Alert className="pointer-events-auto border border-amber-500/40 bg-card text-amber-900 dark:text-amber-200">
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
				{panels.some((panel) => !panel.panelNumberVerified) && (
					<Alert className="pointer-events-none border border-amber-500/40 bg-card text-amber-900 dark:text-amber-200">
						<AlertDescription>Nomor komponen yang belum dicocokkan dengan model LBY tidak ditampilkan. Impor dan periksa ulang model untuk memverifikasi nomor.</AlertDescription>
					</Alert>
				)}
				{selected?.hinges?.length ? (
					<details className="pointer-events-auto max-h-48 w-fit max-w-full overflow-auto rounded-xl border bg-card/95 p-3 text-xs shadow-sm">
						<summary className="cursor-pointer font-semibold">Engsel panel: {selected.hinges.length}</summary>
						{selected.doorOpenType && <p className="mt-2">Bukaan: {({ left: "kiri", right: "kanan", up: "atas", bottom: "bawah" })[selected.doorOpenType]}</p>}
						<ul className="mt-2 space-y-2">
							{selected.hinges.map((hinge) => (
								<li key={hinge.id}>
									<p>{hinge.name}{hinge.code ? ` · ${hinge.code}` : ""}</p>
									<p className="text-muted-foreground">Posisi pada panel (mm), X / Y / Z: {hinge.panelPosition.join(" / ")}</p>
								</li>
							))}
						</ul>
					</details>
				) : null}
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
						<div className={`relative ${immersive ? "h-full" : "h-[min(62dvh,640px)] min-h-80"}`}>
						{!webglFailed && <PanelLocation3D panels={projected} barcode={barcode} hideDoors={hideDoors} showNumbers={showNumbers} explode={explode} width={width} height={height} centerX={-pan.x} centerY={-pan.y} onFailure={handleWebglFailure} />}
						<svg
							ref={viewport}
							viewBox={`${-width / 2 - pan.x} ${-height / 2 - pan.y} ${width} ${height}`}
							className="relative h-full w-full cursor-grab select-none text-foreground active:cursor-grabbing"
							style={{ touchAction: "none" }}
							role="img"
							tabIndex={0}
							aria-label={`Posisi ${panelLabel.toLowerCase()}, barcode ${barcode}, ruang ${selected.roomName}. Geser atau tombol panah untuk memutar. Klik kanan dan geser, atau Shift dan tombol panah untuk menggeser. Scroll, pinch, atau tombol plus dan minus untuk zoom.`}
							data-selected-barcode={barcode}
							data-panel-count={panels.length}
							data-explode={Math.round(explode * 100)}
							data-explode-mode="all"
							data-doors-hidden={hideDoors}
							data-doors-open={doorsOpen}
							data-door-progress={Math.round(doorProgress * 100)}
							onPointerDown={(event) => {
								if (event.button !== 0 && event.button !== 2) return;
								pointers.current.set(event.pointerId, {
									x: event.clientX,
									y: event.clientY,
									button: event.button,
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
								} else if (pointers.current.size === 1 && previous.button === 2) {
									const bounds = event.currentTarget.getBoundingClientRect();
									if (bounds.width > 0 && bounds.height > 0)
										setPan((value) => ({
											x: value.x + (event.clientX - previous.x) * width / bounds.width,
											y: value.y + (event.clientY - previous.y) * height / bounds.height,
										}));
								} else if (pointers.current.size === 1) {
									setYaw(
										(value) => value + (event.clientX - previous.x) * 0.008,
									);
									rotateUp((event.clientY - previous.y) * 0.008);
								}
								pointers.current.set(event.pointerId, {
									x: event.clientX,
									y: event.clientY,
									button: previous.button,
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
							onContextMenu={(event) => event.preventDefault()}
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
								if (event.shiftKey && event.key.startsWith("Arrow")) {
									setPan((value) => ({
										x: value.x + (event.key === "ArrowLeft" ? -width : event.key === "ArrowRight" ? width : 0) * 0.05,
										y: value.y + (event.key === "ArrowUp" ? -height : event.key === "ArrowDown" ? height : 0) * 0.05,
									}));
									return;
								}
								if (event.key === "+" || event.key === "=") changeZoom(0.8);
								if (event.key === "-") changeZoom(1 / 0.8);
								if (event.key === "ArrowLeft") setYaw((value) => value - 0.2);
								if (event.key === "ArrowRight") setYaw((value) => value + 0.2);
								if (event.key === "ArrowUp") rotateUp(-0.2);
								if (event.key === "ArrowDown") rotateUp(0.2);
							}}
						>
							<title>{`${panelLabel} di ruang ${selected.roomName}`}</title>
							<g visibility={webglFailed ? "visible" : "hidden"}>
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
							</g>
							{showNumbers && numberLabels.map((label) => (
								<g key={label.barcode} pointerEvents="none">
									<circle cx={label.x} cy={label.y} r={numberScale * 9} fill="white" stroke="#272b22" strokeWidth={numberScale} />
									<text data-panel-number={label.number} x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={numberScale * Math.min(10, 25 / label.number.length)} fontWeight="bold" fill="#272b22">{label.number}</text>
								</g>
							))}
						</svg>
						</div>
						<div
							className={
								immersive
									? "absolute right-3 top-1/2 flex max-h-[calc(100%-10rem)] -translate-y-1/2 flex-col gap-0.5 overflow-y-auto rounded-full border border-border/50 bg-card/95 p-1.5 shadow-lg"
									: "flex flex-wrap items-center justify-center gap-1 border-t bg-background p-2"
							}
							aria-label="Kontrol tampilan"
						>
							<Button variant="ghost" size="icon" className={showNumbers ? "bg-muted text-foreground" : "text-muted-foreground"} aria-label="Tampilkan nomor panel" aria-pressed={showNumbers} title={showNumbers ? "Sembunyikan nomor panel" : "Tampilkan nomor panel"} onClick={() => setShowNumbers((value) => !value)}>
								<Hash aria-hidden="true" />
							</Button>
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
						<div className="flex w-full items-center gap-2 rounded-full border border-border/50 bg-card/95 px-4 py-1 shadow-sm">
							<label htmlFor={`explode-${barcode}`} className="text-xs font-medium">Jarak</label>
							<input id={`explode-${barcode}`} aria-label="Jarak explode" type="range" min={0} max={100} value={Math.round(explode * 100)} onChange={(event) => setExplode(Number(event.target.value) / 100)} className="h-10 min-w-0 flex-1 cursor-pointer accent-primary" />
							<output htmlFor={`explode-${barcode}`} className="w-10 text-right text-xs tabular-nums">{Math.round(explode * 100)}%</output>
						</div>
						{showNumbers && webglFailed && numberLabels.length < projected.filter((panel) => panel.panelNumberVerified && panel.panelNumber && (panel.barcode === barcode || !hideDoors || !isDoorPanel(panel))).length && (
							<p role="status" className="w-fit rounded-lg bg-card/95 px-3 py-1 text-xs shadow-sm">Sebagian nomor tersembunyi. Putar atau zoom untuk memperjelas.</p>
						)}
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
