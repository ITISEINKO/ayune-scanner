import Link from "next/link";
import { redirect } from "next/navigation";
import { PanelViewerDetailPage } from "@/features/panel-viewer/PanelViewerDetailPage";
import { canImportLby } from "@/lib/db";
import { ppicSession } from "@/lib/session";
import { listTrialModels, readTrialModel, searchTrialPanels } from "@/lib/trialPublicModels";

export const dynamic = "force-dynamic";

export default async function TrialViewer({ searchParams }: { searchParams: Promise<{ id?: string; room?: string; panel?: string; q?: string }> }) {
	const session = await ppicSession();
	if (!session || !(await canImportLby(session.user_id))) redirect("/unauthorized");
	const query = await searchParams;
	const models = await listTrialModels();
	const model = models.find((item) => item.id === query.id && item.activeRevision);
	if (model?.activeRevision) {
		const revision = model.activeRevision;
		const snapshot = await readTrialModel(model.id, revision);
		if (snapshot) return <main className="relative h-dvh w-full overflow-hidden"><PanelViewerDetailPage id={model.id} rooms={snapshot.rooms.map(({ id, name }) => ({ id, name }))} initialRoom={query.room} selectedPanel={query.panel} trialRevision={revision} /><div className="absolute left-3 top-3 z-10 flex gap-2"><Link href="/admin/trial-3d-import/viewer" className="rounded-lg border bg-card p-2 text-sm">Kembali</Link><h1 className="rounded-lg border bg-card p-2 text-sm font-bold">{snapshot.name} · Trial</h1></div></main>;
	}
	const q = typeof query.q === "string" ? query.q.trim() : "";
	const results = await searchTrialPanels(q);
	return <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-6 pb-28"><Link href="/admin/trial-3d-import" className="text-sm underline">Kembali ke import trial</Link><h1 className="text-xl font-bold">Panel Viewer Trial</h1><p className="text-sm text-muted-foreground">Hanya model trial yang aktif ditampilkan.</p><form className="flex gap-2"><input name="q" maxLength={100} defaultValue={q} aria-label="Serial atau nomor panel" placeholder="Serial atau nomor panel" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3" /><button className="rounded-lg bg-primary px-4 text-primary-foreground">Cari</button></form>{q ? results.map((item) => <Link key={`${item.modelId}:${item.roomId}:${item.panelId}`} className="block rounded-xl border p-4 text-sm" href={`/admin/trial-3d-import/viewer?${new URLSearchParams({ id: item.modelId, room: item.roomId, panel: item.panelId })}`}>{item.name} · {item.serial || item.number}</Link>) : models.filter((item) => item.activeRevision).map((item) => <Link key={item.id} className="block rounded-xl border p-4 text-sm font-bold" href={`/admin/trial-3d-import/viewer?${new URLSearchParams({ id: item.id })}`}>{item.name}</Link>)}{q && !results.length && <p className="text-sm text-muted-foreground">Panel tidak ditemukan pada model trial aktif.</p>}</main>;
}
