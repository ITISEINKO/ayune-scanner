"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { isDoorPanel, projectPanelLocations } from "@/lib/panelLocation";

type Projected = ReturnType<typeof projectPanelLocations>;

// Faces can be concave and arbitrarily oriented in the projected coordinate system.
export function triangles(points: number[][], faces: number[][]) {
	const positions: number[] = [];
	for (const face of faces) {
		const vertices = face.map((index) => new THREE.Vector3(...points[index] as [number, number, number]));
		if (vertices.length < 3) continue;
		const normal = new THREE.Vector3();
		for (let i = 0; i < vertices.length; i++) {
			const a = vertices[i], b = vertices[(i + 1) % vertices.length];
			normal.x += (a.y - b.y) * (a.z + b.z);
			normal.y += (a.z - b.z) * (a.x + b.x);
			normal.z += (a.x - b.x) * (a.y + b.y);
		}
		const axis = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
		const drop = axis.indexOf(Math.max(...axis));
		const outline = vertices.map((v) => drop === 0 ? new THREE.Vector2(v.y, v.z) : drop === 1 ? new THREE.Vector2(v.x, v.z) : new THREE.Vector2(v.x, v.y));
		for (const triangle of THREE.ShapeUtils.triangulateShape(outline, []))
			for (const index of triangle) {
				const v = vertices[index];
				positions.push(v.x, -v.y, v.z);
			}
	}
	return positions;
}

export function numberPlacement(points: number[][], faces: number[][]) {
	const positions = triangles(points, faces);
	let best: { center: THREE.Vector3; normal: THREE.Vector3; axis: THREE.Vector3; radius: number; area: number } | null = null;
	for (let i = 0; i < positions.length; i += 9) {
		const a = new THREE.Vector3(...positions.slice(i, i + 3) as [number, number, number]);
		const b = new THREE.Vector3(...positions.slice(i + 3, i + 6) as [number, number, number]);
		const c = new THREE.Vector3(...positions.slice(i + 6, i + 9) as [number, number, number]);
		const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
		const area = normal.length() / 2;
		const perimeter = a.distanceTo(b) + b.distanceTo(c) + c.distanceTo(a);
		if (!area || !perimeter) continue;
		const center = a.clone().multiplyScalar(b.distanceTo(c)).addScaledVector(b, a.distanceTo(c)).addScaledVector(c, a.distanceTo(b)).multiplyScalar(1 / perimeter);
		if (best && (area < best.area * 0.999 || (area <= best.area * 1.001 && center.z <= best.center.z))) continue;
		if (normal.z < 0) normal.negate();
		normal.normalize();
		const axis = b.clone().sub(a).normalize();
		if (axis.x < 0) axis.negate();
		best = { center, normal, axis, radius: 2 * area / perimeter, area };
	}
	return best;
}

export function PanelLocation3D({ panels, barcode, hideDoors, showNumbers, explode, width, height, centerX, centerY, onFailure }: {
	panels: Projected; barcode: string; hideDoors: boolean; explode: number;
	showNumbers: boolean;
	width: number; height: number; centerX: number; centerY: number; onFailure: () => void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const renderer = useRef<THREE.WebGLRenderer | null>(null);
	const numberTextures = useRef(new Map<string, THREE.CanvasTexture>());
	useEffect(() => {
		const element = canvas.current;
		if (!element) return;
		try {
			renderer.current = new THREE.WebGLRenderer({ canvas: element, antialias: true, alpha: true });
		} catch { onFailure(); return; }
		const lost = (event: Event) => { event.preventDefault(); onFailure(); };
		element.addEventListener("webglcontextlost", lost);
		return () => {
			element.removeEventListener("webglcontextlost", lost);
			numberTextures.current.forEach((texture) => texture.dispose());
			numberTextures.current.clear();
			renderer.current?.dispose();
			renderer.current = null;
		};
	}, [onFailure]);
	useEffect(() => {
		const webgl = renderer.current, element = canvas.current;
		if (!webgl || !element || !width || !height) return;
		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		webgl.setSize(rect.width, rect.height, false);
		const scene = new THREE.Scene();
		const depth = Math.max(1, ...panels.flatMap((panel) => [...panel.points, ...panel.hinges.flatMap((hinge) => hinge.points)].map((point) => Math.abs(point[2]) + Math.abs(panel.explodeOffset[2]))));
		const camera = new THREE.OrthographicCamera(centerX - width / 2, centerX + width / 2, -centerY + height / 2, -centerY - height / 2, 0.1, depth * 4 + 2);
		camera.position.z = depth * 2 + 1;
		const materials = [
			new THREE.MeshBasicMaterial({ color: 0xa1a1aa, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false }),
			new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, depthTest: false }),
			new THREE.MeshBasicMaterial({ color: 0x64748b, side: THREE.DoubleSide }),
		];
		const outlines = [new THREE.LineBasicMaterial({ color: 0x52525b, transparent: true, opacity: 0.6 }), new THREE.LineBasicMaterial({ color: 0xbe123c, depthTest: false })];
		const geometries: THREE.BufferGeometry[] = [];
		const numberMaterials: THREE.MeshBasicMaterial[] = [];
		const add = (points: number[][], faces: number[][], material: THREE.Material, offset: number[], order: number) => {
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute("position", new THREE.Float32BufferAttribute(triangles(points, faces), 3));
			geometries.push(geometry);
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.set(offset[0] * explode, -offset[1] * explode, offset[2] * explode);
			mesh.renderOrder = order;
			scene.add(mesh);
		};
		for (const panel of panels) {
			const active = panel.barcode === barcode;
			if (!active && hideDoors && isDoorPanel(panel)) continue;
			add(panel.points, panel.faceIndices, materials[active ? 1 : 0], panel.explodeOffset, active ? 2 : 0);
			const edgePositions = panel.edgeIndices.flatMap((edge) => edge.flatMap((index) => {
				const [x, y, z] = panel.points[index];
				return [x, -y, z];
			}));
			const edges = new THREE.BufferGeometry();
			edges.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
			geometries.push(edges);
			const lines = new THREE.LineSegments(edges, outlines[active ? 1 : 0]);
			lines.position.set(panel.explodeOffset[0] * explode, -panel.explodeOffset[1] * explode, panel.explodeOffset[2] * explode);
			lines.renderOrder = active ? 3 : 1;
			scene.add(lines);
			for (const hinge of panel.hinges) add(hinge.points, hinge.geometry.faces, materials[2], panel.explodeOffset, 1);
			if (showNumbers && panel.panelNumberVerified && panel.panelNumber) {
				const placement = numberPlacement(panel.points, panel.faceIndices);
				if (placement) {
					let texture = numberTextures.current.get(panel.panelNumber);
					if (!texture) {
						const surface = document.createElement("canvas");
						surface.width = 256; surface.height = 128;
						const context = surface.getContext("2d");
						if (!context) continue;
						context.font = "900 120px sans-serif";
						context.textAlign = "center"; context.textBaseline = "middle";
						context.fillStyle = "#1d4ed8"; context.fillText(panel.panelNumber, 128, 64, 246);
						texture = new THREE.CanvasTexture(surface);
						texture.colorSpace = THREE.SRGBColorSpace;
						numberTextures.current.set(panel.panelNumber, texture);
					}
						const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
						const labelHeight = Math.min(70, placement.radius * 0.85);
						const geometry = new THREE.PlaneGeometry(labelHeight * 2, labelHeight);
						const label = new THREE.Mesh(geometry, material);
						const vertical = new THREE.Vector3().crossVectors(placement.normal, placement.axis).normalize();
						label.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(placement.axis, vertical, placement.normal));
						label.position.copy(placement.center).addScaledVector(placement.normal, 0.2);
						label.position.add(new THREE.Vector3(panel.explodeOffset[0] * explode, -panel.explodeOffset[1] * explode, panel.explodeOffset[2] * explode));
						label.renderOrder = 4; scene.add(label);
						geometries.push(geometry); numberMaterials.push(material);
				}
			}
		}
		webgl.render(scene, camera);
		return () => { geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); outlines.forEach((material) => material.dispose()); numberMaterials.forEach((material) => material.dispose()); };
	}, [panels, barcode, hideDoors, showNumbers, explode, width, height, centerX, centerY]);
	return <canvas ref={canvas} data-show-numbers={showNumbers} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
