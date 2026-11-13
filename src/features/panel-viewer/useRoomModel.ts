import { useEffect, useState } from "react";
import type { PublicRoomGeometry } from "@/types/publicModel";
export function useRoomModel(id: string, room: string, trialRevision?: string, locationViewer = false) {
	const [parts, setParts] = useState<PublicRoomGeometry | null>(null);
	const [status, setStatus] = useState<{
		kind: "loading" | "ready" | "empty" | "error";
	}>({ kind: "loading" });
	useEffect(() => {
		if (!room) return;
		const abort = new AbortController();
		setParts(null);
		setStatus({ kind: "loading" });
		fetch(
			trialRevision
				? `${locationViewer ? "/api/panel/trial-model" : "/api/admin/trial-3d-import"}?${new URLSearchParams({ id, revision: trialRevision, room })}`
				: `/api/public-models/${encodeURIComponent(id)}/${encodeURIComponent(room)}`,
			{ signal: abort.signal },
		)
			.then((response) => {
				if (!response.ok) throw new Error("Model unavailable");
				return response.json() as Promise<PublicRoomGeometry>;
			})
			.then((data) => {
				if (!abort.signal.aborted) {
					setParts(data);
					if (!data.length) setStatus({ kind: "empty" });
				}
			})
			.catch((error) => {
				if (!abort.signal.aborted) {
					console.error("Model tidak dapat dimuat:", error);
					setStatus({ kind: "error" });
				}
			});
		return () => abort.abort();
	}, [id, room, trialRevision, locationViewer]);
	return {
		parts,
		status,
		setStatus,
		missingHinges:
			parts?.filter((part) => part.doorOpenType && part.hingeCount === 0)
				.length ?? 0,
		hingeCheckUnavailable:
			parts?.some(
				(part) => part.doorOpenType && part.hingeCount === undefined,
			) ?? false,
		unresolvedDoors:
			parts?.filter((part) => part.doorOpenType && !part.doorMotion).length ??
			0,
		hasDoors: parts?.some((part) => part.isDoor || part.doorOpenType) ?? false,
		hasDrawers: parts?.some((part) => part.drawerOffset) ?? false,
	};
}
