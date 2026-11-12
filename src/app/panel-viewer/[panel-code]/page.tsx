import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicRooms } from '@/lib/publicModels';
import { PanelViewerDetailPage } from '@/features/panel-viewer/PanelViewerDetailPage';

export const dynamic = 'force-dynamic';
export default async function PanelViewerDetail({ params }: { params: Promise<{ 'panel-code': string }> }) {
	const id = (await params)['panel-code'];
	const model = await publicRooms(id);
	if (!model) notFound();
	return <main className="relative h-dvh w-full overflow-hidden"><header className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start gap-2 sm:inset-x-5 sm:top-5"><Link href="/panel-viewer" className="pointer-events-auto shrink-0 rounded-lg border bg-card/95 px-3 py-2 text-sm font-medium shadow-sm">← Semua model</Link><h1 title={model.name} className="min-w-0 truncate rounded-lg border bg-card/95 px-3 py-2 text-sm font-bold shadow-sm sm:text-base">{model.name}</h1></header><PanelViewerDetailPage id={id} rooms={model.rooms} /></main>;
}
