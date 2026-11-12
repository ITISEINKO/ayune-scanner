import Link from 'next/link';
import { publicModels } from '@/lib/publicModels';

export const dynamic = 'force-dynamic';
export default async function PanelViewer() {
	const models = await publicModels();
	return <main className="mx-auto max-w-3xl p-5"><h1 className="text-2xl font-bold">Model 3D</h1><p className="mt-2 text-sm text-muted-foreground">Pilih model untuk melihat ruangan.</p>
		{models.length ? <ul className="mt-5 grid gap-3">{models.map((model) => <li key={model.id}><Link className="block rounded-xl border bg-card p-4 font-semibold hover:bg-muted" href={`/panel-viewer/${model.id}`}>{model.name}</Link></li>)}</ul> : <p className="mt-5">Belum ada model yang diimpor.</p>}
	</main>;
}
