import { publicRoom } from '@/lib/publicModels';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; room: string }> }) {
	const { id, room } = await params;
	const data = await publicRoom(id, room);
	return data ? new Response(data, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) : new Response(null, { status: 404 });
}
