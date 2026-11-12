import { publicTexture } from '@/lib/publicModels';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const texture = await publicTexture((await params).id);
	return texture ? new Response(new Uint8Array(texture.image), { headers: { 'Content-Type': texture.mime, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } }) : new Response(null, { status: 404 });
}
