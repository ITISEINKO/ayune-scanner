import { PageHeader } from "@/components/pageHeader";
import { MemberScanOverview } from "@/features/settings/MemberScanOverview";

export default async function MemberScanOverviewPage({
	params,
}: {
	params: Promise<{ "user-id": string }>;
}) {
	const { "user-id": memberId } = await params;

	return (
		<main className="mx-auto min-h-dvh max-w-120 bg-background pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
			<PageHeader
				eyebrow="Pengguna"
				title="Ringkasan Scan"
				backHref={`/admin/users/${encodeURIComponent(memberId)}`}
			/>
			<MemberScanOverview memberId={memberId} />
		</main>
	);
}
