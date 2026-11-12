"use client";

import { useEffect, useRef, useState } from "react";
import { DoorOpen, EyeOff, ScanEye, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { PublicRoomGeometry } from "@/types/publicModel";

export function PanelViewerDetailPage({
	id,
	rooms,
	initialRoom,
	selectedPanel,
}: {
	id: string;
	rooms: { id: string; name: string }[];
	initialRoom?: string;
	selectedPanel?: string;
}) {
	const [room, setRoom] = useState(rooms.some((item) => item.id === initialRoom) ? initialRoom! : rooms[0]?.id ?? "");
	const [status, setStatus] = useState("");
	const [unresolvedDoors, setUnresolvedDoors] = useState(0);
	const [doorsOpen, setDoorsOpen] = useState(false);
	const [hideDoors, setHideDoors] = useState(false);
	const [xray, setXray] = useState(false);
	const [numbers, setNumbers] = useState(false);
	const [explode, setExplode] = useState(0);
	const container = useRef<HTMLDivElement>(null);
	const update = useRef<() => void>(() => {});
	const doorProgress = useRef(0);
	const settings = useRef({ doorsOpen, hideDoors, xray, numbers, explode });
	settings.current = { doorsOpen, hideDoors, xray, numbers, explode };
	useEffect(() => {
		update.current();
	}, [doorsOpen, hideDoors, xray, numbers, explode]);
	useEffect(() => {
		const target = doorsOpen ? 1 : 0;
		const from = doorProgress.current;
		if (from === target) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			doorProgress.current = target;
			update.current();
			return;
		}
		const started = performance.now();
		let frame = 0;
		const step = (now: number) => {
			const elapsed = Math.min(1, (now - started) / 450);
			const eased = elapsed * elapsed * (3 - 2 * elapsed);
			doorProgress.current = from + (target - from) * eased;
			update.current();
			if (elapsed < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	}, [doorsOpen]);
	useEffect(() => {
		const target = container.current;
		if (!target || !room) return;
		const abort = new AbortController();
		let dispose = () => {};
		setStatus("Memuat model…");
		setUnresolvedDoors(0);
		(async () => {
			const [response, THREE, { OrbitControls }] = await Promise.all([
				fetch(
					`/api/public-models/${encodeURIComponent(id)}/${encodeURIComponent(room)}`,
					{ signal: abort.signal },
				),
				import("three"),
				import("three/examples/jsm/controls/OrbitControls.js"),
			]);
			if (!response.ok) throw new Error("Model unavailable");
			const parts = (await response.json()) as PublicRoomGeometry;
			if (abort.signal.aborted) return;
			setUnresolvedDoors(parts.filter((part) => part.doorOpenType && !part.doorMotion).length);
			if (!parts.length) {
				setStatus("Tidak ada panel pada ruangan ini.");
				return;
			}
			const box = new THREE.Box3();
			for (const part of parts)
				for (let i = 0; i < part.position.length; i += 3)
					box.expandByPoint(
						new THREE.Vector3(
							part.position[i],
							part.position[i + 1],
							part.position[i + 2],
						),
					);
			const center = box.getCenter(new THREE.Vector3()),
				size = box.getSize(new THREE.Vector3());
			const extent = Math.max(size.x, size.y, size.z, 1);
			const scene = new THREE.Scene();
			scene.background = new THREE.Color(0xf5f5f4);
			const materials = new Map<string, InstanceType<typeof THREE.MeshLambertMaterial>>();
			const textures = new Map<string, InstanceType<typeof THREE.Texture>>();
			const hingeMaterial = new THREE.MeshLambertMaterial({
				color: 0x737b85,
				side: THREE.DoubleSide,
			});
			const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x403b35, transparent: true, opacity: 0.55 });
			scene.add(new THREE.AmbientLight(0xffffff, 1.7));
			const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
			const sprites: InstanceType<typeof THREE.Sprite>[] = [];
			const panels = parts.map((part) => {
				const geometry = new THREE.BufferGeometry();
				geometry.setAttribute(
					"position",
					new THREE.Float32BufferAttribute(part.position, 3),
				);
				geometry.setIndex(part.index);
				if (part.uv?.length === part.position.length / 3 * 2) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
				geometry.computeVertexNormals();
				geometry.computeBoundingBox();
				const bounds = geometry.boundingBox!,
					middle = bounds.getCenter(new THREE.Vector3());
				const pivot = part.doorMotion ? new THREE.Vector3().fromArray(part.doorMotion.pivot) : middle.clone();
				geometry.translate(-pivot.x, -pivot.y, -pivot.z);
				geometries.push(geometry);
				const group = new THREE.Group();
				group.position.copy(pivot).sub(center);
				const axis = part.doorMotion ? new THREE.Vector3().fromArray(part.doorMotion.axis) : null;
				const normal = axis ? new THREE.Vector3().subVectors(middle, pivot).cross(axis).normalize() : null;
				const hinges: { geometry: InstanceType<typeof THREE.BufferGeometry>; source: Float32Array; weights: number[] }[] = [];
				const selected = room === initialRoom && part.id === selectedPanel && Boolean(selectedPanel);
				const materialKey = selected ? 'selected-panel' : `${part.texture || ''}:${part.color ?? ''}`;
				let material = materials.get(materialKey);
				if (!material) {
					material = new THREE.MeshLambertMaterial({ color: selected ? 0xef4444 : part.color ?? 0xd4c3a5, side: THREE.DoubleSide });
					materials.set(materialKey, material);
				}
				const mesh = new THREE.Mesh(geometry, material);
				group.add(mesh);
				const edges = new THREE.EdgesGeometry(geometry, 20);
				geometries.push(edges);
				group.add(new THREE.LineSegments(edges, outlineMaterial));
				scene.add(group);
				for (const hinge of part.hinges ?? []) {
					const hingeGeometry = new THREE.BufferGeometry();
					hingeGeometry.setAttribute(
						"position",
						new THREE.Float32BufferAttribute(hinge.position, 3),
					);
					if (hinge.index.length) hingeGeometry.setIndex(hinge.index);
					hingeGeometry.applyMatrix4(
						new THREE.Matrix4().fromArray(hinge.matrix),
					);
					hingeGeometry.translate(-pivot.x, -pivot.y, -pivot.z);
					if (normal && normal.lengthSq() > 0) {
						const source = new Float32Array(hingeGeometry.getAttribute("position").array);
						const origin = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(hinge.matrix)).sub(pivot);
						const depths = Array.from({ length: source.length / 3 }, (_, i) => Math.abs(new THREE.Vector3().fromArray(source, i * 3).sub(origin).dot(normal)));
						const near = Math.min(...depths), far = Math.max(...depths);
						// shortcut: blend hinge depth between mounts; exact articulation needs hinge joint data.
						hinges.push({ geometry: hingeGeometry, source, weights: depths.map((depth) => far > near ? (depth - near) / (far - near) : 1) });
					}
					hingeGeometry.computeVertexNormals();
					geometries.push(hingeGeometry);
					const mesh = new THREE.Mesh(hingeGeometry, hingeMaterial);
					mesh.frustumCulled = false;
					group.add(mesh);
				}
				let label: InstanceType<typeof THREE.Sprite> | null = null;
				if (part.number) {
					const canvas = document.createElement("canvas");
					canvas.width = 128;
					canvas.height = 128;
					const context = canvas.getContext("2d");
					if (context) {
						context.fillStyle = "#0000ff";
						context.textAlign = "center";
						context.textBaseline = "middle";
						context.font = "bold 80px sans-serif";
						context.fillText(part.number, 64, 64, 100);
						const texture = new THREE.CanvasTexture(canvas);
						const spriteMaterial = new THREE.SpriteMaterial({
							map: texture,
							depthTest: false,
							depthWrite: false,
						});
						label = new THREE.Sprite(spriteMaterial);
						label.position.copy(middle).sub(pivot);
						label.scale.setScalar(extent * 0.05);
						label.renderOrder = 2;
						group.add(label);
						sprites.push(label);
					}
				}
				return {
					part,
					group,
					mesh,
					pivot: pivot.sub(center),
					middle: middle.sub(center),
					axis,
					hinges,
					label,
				};
			});
			const light = new THREE.DirectionalLight(0xffffff, 2);
			light.position.set(1, -1, 2);
			scene.add(light);
			const camera = new THREE.PerspectiveCamera(
				45,
				1,
				extent / 10000,
				extent * 100,
			);
			camera.up.set(0, 0, 1);
			camera.position.set(extent * 1.5, -extent * 1.5, extent);
			const renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
			target.appendChild(renderer.domElement);
			const controls = new OrbitControls(camera, renderer.domElement);
			const raycaster = new THREE.Raycaster();
			const render = () => {
				if (settings.current.numbers) {
					scene.updateMatrixWorld(true);
					const visibleMeshes = panels.filter((panel) => panel.group.visible).map((panel) => panel.mesh);
					for (const panel of panels) {
						if (!panel.label || !panel.group.visible) continue;
						const center = panel.group.localToWorld(panel.middle.clone().sub(panel.pivot));
						raycaster.set(camera.position, center.sub(camera.position).normalize());
						// shortcut: one ray per label scans visible panels; use a spatial index if large models make orbiting slow.
						const hit = raycaster.intersectObjects(visibleMeshes)[0];
						panel.label.visible = hit?.object === panel.mesh;
						if (panel.label.visible && hit) panel.label.position.copy(panel.group.worldToLocal(hit.point));
					}
				}
				renderer.render(scene, camera);
			};
			for (const id of new Set(parts.map((part) => part.texture).filter((id): id is string => Boolean(id)))) {
				const texture = new THREE.TextureLoader().load(`/api/public-textures/${encodeURIComponent(id)}`, (loaded) => {
					if (abort.signal.aborted) { loaded.dispose(); return; }
					loaded.colorSpace = THREE.SRGBColorSpace; loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping; loaded.repeat.set(2, 2);
					for (const [key, material] of materials) if (key.startsWith(`${id}:`)) { material.map = loaded; material.color.set(0xffffff); material.needsUpdate = true; }
					render();
				});
				textures.set(id, texture);
			}
			update.current = () => {
				const s = settings.current;
				renderer.domElement.dataset.doorProgress = String(
					Math.round(doorProgress.current * 100),
				);
				for (const material of materials.values()) {
					if (material.transparent !== s.xray) { material.transparent = s.xray; material.needsUpdate = true; }
					material.opacity = s.xray ? 0.28 : 1;
					material.depthWrite = !s.xray;
				}
				for (const panel of panels) {
					panel.group.visible = !(s.hideDoors && panel.part.isDoor);
					panel.group.position
						.copy(panel.pivot)
						.addScaledVector(panel.middle, (s.explode / 100) * 0.6);
					panel.group.rotation.set(0, 0, 0);
					const opening = panel.part.doorOpenType;
					if (opening && panel.axis) {
						const angle =
							(((opening === "left" || opening === "up" ? -1 : 1) * Math.PI) /
								2) *
							doorProgress.current;
						panel.group.quaternion.setFromAxisAngle(panel.axis, angle);
					}
					const inverse = panel.group.quaternion.clone().invert();
					for (const hinge of panel.hinges) {
						const position = hinge.geometry.getAttribute("position") as InstanceType<typeof THREE.BufferAttribute>;
						for (let i = 0; i < position.count; i++) {
							const point = new THREE.Vector3().fromArray(hinge.source, i * 3);
							point.lerp(point.clone().applyQuaternion(inverse), hinge.weights[i]);
							position.setXYZ(i, point.x, point.y, point.z);
						}
						position.needsUpdate = true;
						hinge.geometry.computeVertexNormals();
					}
					if (panel.label) panel.label.visible = s.numbers;
				}
				render();
			};
			controls.addEventListener("change", render);
			const resize = new ResizeObserver(() => {
				const { clientWidth, clientHeight } = target;
				if (!clientWidth || !clientHeight) return;
				camera.aspect = clientWidth / clientHeight;
				camera.updateProjectionMatrix();
				renderer.setSize(clientWidth, clientHeight);
				render();
			});
			resize.observe(target);
			controls.update();
			update.current();
			setStatus("");
			dispose = () => {
				update.current = () => {};
				resize.disconnect();
				controls.dispose();
				geometries.forEach((geometry) => geometry.dispose());
				sprites.forEach((sprite) => {
					sprite.material.map?.dispose();
					sprite.material.dispose();
				});
				materials.forEach((material) => material.dispose());
				textures.forEach((texture) => texture.dispose());
				hingeMaterial.dispose();
				outlineMaterial.dispose();
				renderer.dispose();
				renderer.domElement.remove();
			};
		})().catch(() => {
			if (!abort.signal.aborted)
				setStatus("Model tidak dapat dimuat. Coba pilih ruangan lagi.");
		});
		return () => {
			abort.abort();
			dispose();
		};
	}, [id, room, initialRoom, selectedPanel]);
	return (
		<section className="absolute inset-0" aria-label="Viewer model 3D">
			<div
				ref={container}
				className="absolute inset-0"
				aria-label="Model 3D interaktif"
			/>
			{status && (
				<p
					role="status"
					className="pointer-events-none absolute inset-0 grid place-items-center bg-background/80 p-4 text-center"
				>
					{status}
				</p>
			)}
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
					<SelectContent align="start" alignItemWithTrigger={false}>
						{rooms.map((item) => (
							<SelectItem key={item.id} value={item.id}>
								{item.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div
				className="absolute right-3 top-1/2 flex max-h-[60%] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-xl border bg-card/95 p-1.5 shadow-sm sm:right-5"
				role="toolbar"
				aria-label="Kontrol model"
			>
				{[
					{
						active: doorsOpen,
						toggle: setDoorsOpen,
						label: "Buka pintu",
						Icon: DoorOpen,
					},
					{
						active: hideDoors,
						toggle: setHideDoors,
						label: "Sembunyikan pintu",
						Icon: EyeOff,
					},
					{ active: xray, toggle: setXray, label: "X-ray", Icon: ScanEye },
					{
						active: numbers,
						toggle: setNumbers,
						label: "Nomor panel",
						Icon: Hash,
					},
				].map(({ active, toggle, label, Icon }) => (
					<Button
						key={label}
						type="button"
						variant={active ? "secondary" : "ghost"}
						size="icon"
						aria-label={label}
						title={label}
						aria-pressed={active}
						onClick={() => toggle((value) => !value)}
					>
						<Icon aria-hidden="true" />
					</Button>
				))}
			</div>
			<div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] rounded-xl border bg-card/95 p-3 shadow-sm sm:left-5 sm:right-auto sm:w-96">
				{unresolvedDoors > 0 && <p role="status" className="mb-2 text-xs text-amber-700">{unresolvedDoors} pintu tidak dianimasikan karena arah bukanya belum dapat dipastikan.</p>}
				<div className="flex items-center gap-3">
					<span className="text-sm font-semibold">
						Explode
					</span>
					<Slider
						aria-label="Explode"
						value={explode}
						onValueChange={setExplode}
						className="min-w-0 flex-1"
					/>
					<output className="text-sm">
						{explode}%
					</output>
				</div>
			</div>
		</section>
	);
}
