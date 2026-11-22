import { ProfileLayout } from "@/features/profile";
import type { getProfile } from "@/features/profile/getProfile";

export function MemberProfilePage({
	profile,
}: {
	profile: Awaited<ReturnType<typeof getProfile>>;
}) {
	return <ProfileLayout role="MEMBER" initialProfile={profile} />;
}
