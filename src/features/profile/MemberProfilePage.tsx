import { ProfileLayout } from "@/features/profile";
import { MemberScanOverview } from "@/features/settings/MemberScanOverview";

export function MemberProfilePage() {
	return (
		<ProfileLayout role="MEMBER">
			<section className="mt-4" aria-labelledby="member-overview-title">
				<h2 id="member-overview-title" className="px-4 text-lg font-bold">
					Overview kamu
				</h2>
				<MemberScanOverview />
			</section>
		</ProfileLayout>
	);
}
