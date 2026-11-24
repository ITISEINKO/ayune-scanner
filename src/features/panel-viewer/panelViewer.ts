import type { PublicRoomGeometry } from "@/types/publicModel";
export async function createPanelViewer(
	target: HTMLDivElement,
	parts: PublicRoomGeometry,
	modelId: string,
	trialRevision: string,
	locationViewer = false,
	onSelect?: (id: string, number: string, multi: boolean) => void,
	onContextMenu?: (id: string, number: string) => void,
) {
	const [THREE, { OrbitControls }] = await Promise.all([
		import("three"),
		import("three/examples/jsm/controls/OrbitControls.js"),
	]);
	let disposed = false,
		doorProgress = 0,
		frame = 0;
	let settings = { hideDoors: false, xray: false, numbers: false, explode: 0 };
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
	const materials = new Map<
		string,
		InstanceType<typeof THREE.MeshLambertMaterial>
	>();
	const textures = new Map<string, InstanceType<typeof THREE.Texture>>();
	const hingeMaterial = new THREE.MeshLambertMaterial({
		color: 0x737b85,
		side: THREE.DoubleSide,
	});
	const outlineMaterial = new THREE.LineBasicMaterial({
		color: 0x403b35,
		transparent: true,
		opacity: 0.55,
	});
	const selectedOutlineMaterial = new THREE.LineBasicMaterial({
		color: 0xb6ff00,
		depthTest: false,
	});
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
		if (part.uv?.length === (part.position.length / 3) * 2)
			geometry.setAttribute("uv", new THREE.Float32BufferAttribute(part.uv, 2));
		geometry.computeVertexNormals();
		geometry.computeBoundingBox();
		const bounds = geometry.boundingBox!,
			middle = bounds.getCenter(new THREE.Vector3());
		const pivot = part.doorMotion
			? new THREE.Vector3().fromArray(part.doorMotion.pivot)
			: middle.clone();
		geometry.translate(-pivot.x, -pivot.y, -pivot.z);
		geometries.push(geometry);
		const group = new THREE.Group();
		group.position.copy(pivot).sub(center);
		const axis = part.doorMotion
			? new THREE.Vector3().fromArray(part.doorMotion.axis)
			: null;
		const missingHinge = Boolean(part.doorOpenType && part.hingeCount === 0);
		const materialKey = missingHinge
			? "missing-hinge"
			: `${part.texture || ""}:${part.color ?? ""}`;
		let material = materials.get(materialKey);
		if (!material) {
			material = new THREE.MeshLambertMaterial({
				color: missingHinge ? 0xf59e0b : (part.color ?? 0xd4c3a5),
				side: THREE.DoubleSide,
			});
			materials.set(materialKey, material);
		}
		const mesh = new THREE.Mesh(geometry, material);
		group.add(mesh);
		const edges = new THREE.EdgesGeometry(geometry, 20);
		geometries.push(edges);
		group.add(new THREE.LineSegments(edges, outlineMaterial));
		const selectedOutline = new THREE.LineSegments(edges, selectedOutlineMaterial);
		selectedOutline.visible = false;
		selectedOutline.renderOrder = 2;
		group.add(selectedOutline);
		scene.add(group);
		for (const hinge of [...(part.hinges ?? []), ...(part.drawerRails ?? [])]) {
			const hingeGeometry = new THREE.BufferGeometry();
			hingeGeometry.setAttribute(
				"position",
				new THREE.Float32BufferAttribute(hinge.position, 3),
			);
			if (hinge.index.length) hingeGeometry.setIndex(hinge.index);
			hingeGeometry.applyMatrix4(new THREE.Matrix4().fromArray(hinge.matrix));
			hingeGeometry.translate(-pivot.x, -pivot.y, -pivot.z);
			hingeGeometry.computeVertexNormals();
			geometries.push(hingeGeometry);
			const mesh = new THREE.Mesh(hingeGeometry, hingeMaterial);
			group.add(mesh);
		}
		let label: InstanceType<typeof THREE.Sprite> | null = null;
		if (part.number) {
			const canvas = document.createElement("canvas");
			canvas.width = 128;
			canvas.height = 128;
			const context = canvas.getContext("2d");
			if (context) {
				context.fillStyle = "#B6FF00";
				context.textAlign = "center";
				context.textBaseline = "middle";
				context.font = "bold 80px sans-serif";
				context.fillText(part.number, 64, 64, 100);
				const texture = new THREE.CanvasTexture(canvas);
				texture.colorSpace = THREE.SRGBColorSpace;
				const spriteMaterial = new THREE.SpriteMaterial({
					map: texture,
					depthTest: false,
					depthWrite: false,
				});
				label = new THREE.Sprite(spriteMaterial);
				label.position.copy(middle).sub(pivot);
				label.scale.setScalar(extent * 0.035);
				label.renderOrder = 2;
				group.add(label);
				sprites.push(label);
			}
		}
		return {
			part,
			group,
			mesh,
			selectedOutline,
			pivot: pivot.sub(center),
			middle: middle.sub(center),
			axis,
			drawerOffset: part.drawerOffset
				? new THREE.Vector3().fromArray(part.drawerOffset)
				: null,
			label,
		};
	});
	const light = new THREE.DirectionalLight(0xffffff, 2);
	light.position.set(1, -1, 2);
	scene.add(light);
	const camera = new THREE.PerspectiveCamera(45, 1, extent / 100, extent * 100);
	camera.up.set(0, 0, 1);
	camera.position.set(extent * 1.5, -extent * 1.5, extent);
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	target.appendChild(renderer.domElement);
	const controls = new OrbitControls(camera, renderer.domElement);
	const initialCameraPosition = camera.position.clone();
	const initialCameraTarget = controls.target.clone();
	const raycaster = new THREE.Raycaster();
	const hiddenPanelIds = new Set<string>();
	let pointerStart: { x: number; y: number; id: number } | null = null;
	const pointerDown = (event: PointerEvent) => {
		if (event.isPrimary && event.button === 0) pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
	};
	const panelAt = (x: number, y: number) => {
		const rect = renderer.domElement.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		scene.updateMatrixWorld(true);
		raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
		const hit = raycaster.intersectObjects(panels.filter((panel) => panel.group.visible).map((panel) => panel.mesh))[0];
		return panels.find((item) => item.mesh === hit?.object);
	};
	const pointerUp = (event: PointerEvent) => {
		const start = pointerStart;
		pointerStart = null;
		if (!onSelect || !start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
		const panel = panelAt(event.clientX, event.clientY);
		if (panel?.part.id) onSelect(panel.part.id, panel.part.number, event.ctrlKey || event.metaKey);
	};
	const contextMenu = (event: MouseEvent) => {
		if (!onContextMenu) return;
		const panel = panelAt(event.clientX, event.clientY);
		if (panel?.part.id) onContextMenu(panel.part.id, panel.part.number);
	};
	const pointerCancel = () => { pointerStart = null; };
	if (onSelect) {
		renderer.domElement.addEventListener("pointerdown", pointerDown);
		renderer.domElement.addEventListener("pointerup", pointerUp);
		renderer.domElement.addEventListener("pointercancel", pointerCancel);
	}
	if (onContextMenu) renderer.domElement.addEventListener("contextmenu", contextMenu);
	const render = () => {
		if (settings.numbers) {
			scene.updateMatrixWorld(true);
			const visibleMeshes = panels
				.filter((panel) => panel.group.visible)
				.map((panel) => panel.mesh);
			for (const panel of panels) {
				if (!panel.label || !panel.group.visible) continue;
				const center = panel.group.localToWorld(
					panel.middle.clone().sub(panel.pivot),
				);
				raycaster.set(camera.position, center.sub(camera.position).normalize());
				// shortcut: one ray per label scans visible panels; use a spatial index if large models make orbiting slow.
				const hit = raycaster.intersectObjects(visibleMeshes)[0];
				panel.label.visible = hit?.object === panel.mesh;
				if (panel.label.visible && hit)
					panel.label.position.copy(panel.group.worldToLocal(hit.point));
			}
		}
		renderer.render(scene, camera);
	};
	const textureLoads = [
		...new Set(
			parts
				.map((part) => part.texture)
				.filter((id): id is string => Boolean(id)),
		),
	].map(
		(id) =>
			new Promise<void>((resolve) => {
				const texture = new THREE.TextureLoader().load(
					`${locationViewer ? "/api/panel/trial-model" : "/api/admin/trial-3d-import"}?${new URLSearchParams({ id: modelId, revision: trialRevision, texture: id })}`,
					(loaded) => {
						if (!disposed) {
							loaded.colorSpace = THREE.SRGBColorSpace;
							loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
							loaded.repeat.set(2, 2);
							for (const [key, material] of materials)
								if (key.startsWith(`${id}:`)) {
									material.map = loaded;
									material.color.set(0xffffff);
									material.needsUpdate = true;
								}
						} else loaded.dispose();
						resolve();
					},
					undefined,
					() => resolve(),
				);
				textures.set(id, texture);
			}),
	);
	const update = () => {
		const s = settings;
		renderer.domElement.dataset.doorProgress = String(
			Math.round(doorProgress * 100),
		);
		for (const material of materials.values()) {
			const transparent = s.xray;
			if (material.transparent !== transparent) {
				material.transparent = transparent;
				material.needsUpdate = true;
			}
			material.opacity = transparent ? 0.28 : 1;
			material.depthWrite = !transparent;
		}
		const fadeHardware = s.xray;
		if (hingeMaterial.transparent !== fadeHardware) {
			hingeMaterial.transparent = fadeHardware;
			hingeMaterial.needsUpdate = true;
		}
		hingeMaterial.opacity = fadeHardware ? 0.28 : 1;
		hingeMaterial.depthWrite = !fadeHardware;
		for (const panel of panels) {
			panel.group.visible =
				!(s.hideDoors && panel.part.isDoor) &&
				!(panel.part.id && hiddenPanelIds.has(panel.part.id));
			panel.group.position
				.copy(panel.pivot)
				.addScaledVector(panel.middle, (s.explode / 100) * 0.6);
			if (panel.drawerOffset)
				panel.group.position.addScaledVector(panel.drawerOffset, doorProgress);
			panel.group.rotation.set(0, 0, 0);
			const opening = panel.part.doorOpenType;
			if (opening && panel.axis && !panel.part.drawerOffset) {
				const angle =
					(((opening === "left" || opening === "up" ? -1 : 1) * Math.PI) / 2) *
					doorProgress;
				panel.group.quaternion.setFromAxisAngle(panel.axis, angle);
			}
			if (panel.label) panel.label.visible = s.numbers && panel.group.visible;
		}
		renderer.render(scene, camera);
	};
	const scaleLabels = () =>
		sprites.forEach((sprite) =>
			sprite.scale.setScalar(
				extent *
					(window.innerWidth < 640 ? 0.02 : 0.035) *
					Math.max(1, camera.position.distanceTo(controls.target) / extent),
			),
		);
	controls.addEventListener("change", () => {
		scaleLabels();
		renderer.render(scene, camera);
	});
	controls.addEventListener("end", render);
	const resize = new ResizeObserver(() => {
		const { clientWidth, clientHeight } = target;
		if (!clientWidth || !clientHeight) return;
		scaleLabels();
		camera.aspect = clientWidth / clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(clientWidth, clientHeight);
		render();
	});
	resize.observe(target);
	controls.update();
	update();
	const dispose = () => {
		disposed = true;
		renderer.domElement.removeEventListener("pointerdown", pointerDown);
		renderer.domElement.removeEventListener("pointerup", pointerUp);
		renderer.domElement.removeEventListener("pointercancel", pointerCancel);
		renderer.domElement.removeEventListener("contextmenu", contextMenu);
		cancelAnimationFrame(frame);
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
		selectedOutlineMaterial.dispose();
		renderer.dispose();
		renderer.domElement.remove();
	};
	return {
		ready: Promise.all(textureLoads),
		apply(next: typeof settings) {
			settings = next;
			update();
			render();
		},
		resetView() {
			camera.position.copy(initialCameraPosition);
			controls.target.copy(initialCameraTarget);
			controls.update();
			render();
		},
		setHidden(ids: string[]) {
			hiddenPanelIds.clear();
			ids.forEach((id) => hiddenPanelIds.add(id));
			update();
		},
		setSelected(ids: string[] = [], pinnedId?: string) {
			const selectedIds = new Set(ids);
			for (const panel of panels) {
				panel.selectedOutline.visible = Boolean(
					panel.part.id &&
					(selectedIds.has(panel.part.id) || panel.part.id === pinnedId),
				);
				panel.selectedOutline.material = selectedOutlineMaterial;
			}
			update();
		},
		setDoorsOpen(open: boolean) {
			cancelAnimationFrame(frame);
			const target = open ? 1 : 0,
				from = doorProgress;
			if (from === target) return;
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				doorProgress = target;
				update();
				render();
				return;
			}
			const started = performance.now();
			const step = (now: number) => {
				const elapsed = Math.min(1, (now - started) / 450),
					eased = elapsed * elapsed * (3 - 2 * elapsed);
				doorProgress = from + (target - from) * eased;
				update();
				if (elapsed < 1) frame = requestAnimationFrame(step);
				else render();
			};
			frame = requestAnimationFrame(step);
		},
		dispose,
	};
}
