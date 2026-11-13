import Link from "next/link";
import { publicModels, searchPublicPanels } from "@/lib/publicModels";
import { PanelViewerSearch } from "@/features/panel-viewer/PanelViewerPage";

export const dynamic = "force-dynamic";
export default async function PanelViewer({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const query = (await searchParams).q;
	const code =
		typeof query === "string" && query.length <= 100 ? query.trim() : "";
	const [models, results] = await Promise.all([
		publicModels(),
		code ? searchPublicPanels(code) : [],
	]);
	return (
		<main className="mx-auto max-w-3xl p-5">
			<h1 className="text-2xl font-bold">Model 3D</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				Scan atau masukkan serial atau nomor panel.
			</p>
			<PanelViewerSearch />
			{code && (
				<section className="mt-5" aria-label="Hasil pencarian">
					<h2 className="font-bold">Hasil untuk {code}</h2>
					{results.length ? (
						<ul className="mt-3 grid gap-2">
							{results.map((result) => (
								<li
									key={`${result.modelId}:${result.roomId}:${result.panelId}`}
								>
									<Link
										className="block rounded-xl border bg-card p-4 hover:bg-muted"
										href={`/panel-viewer/${encodeURIComponent(result.modelId)}?${new URLSearchParams({ room: result.roomId, panel: result.panelId })}`}
									>
										<span className="block font-semibold">
											{result.modelName} · {result.roomName}
										</span>
										<span className="text-sm text-muted-foreground">
											{result.number ? `Panel ${result.number}` : "Panel"}
											{result.serial ? ` · Serial ${result.serial}` : ""}
										</span>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-sm">
							Serial atau nomor panel tidak ditemukan pada model yang tersedia.
						</p>
					)}
				</section>
			)}
			<h2 className="mt-7 font-bold">Semua model</h2>
			{models.length ? (
				<ul className="mt-5 grid gap-3">
					{models.map((model) => (
						<li key={model.id}>
							<Link
								className="block rounded-xl border bg-card p-4 font-semibold hover:bg-muted"
								href={`/panel-viewer/${model.id}`}
							>
								{model.name}
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-5">Belum ada model yang diimpor.</p>
			)}
		</main>
	);
}
