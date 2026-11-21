import { ProfileLayout } from "@/features/profile";
import { getAppSession } from "@/lib/session";
import { getProfile } from "@/features/profile/getProfile";

export async function AdminProfilePage() {
	const session = await getAppSession();
	return <ProfileLayout role={session?.role ?? "SUPER_ADMIN"} initialProfile={await getProfile()} />;
}
