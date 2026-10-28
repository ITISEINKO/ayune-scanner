import { ProfileLayout } from "@/features/profile";
import { ppicSession } from "@/lib/session";

export async function AdminProfilePage() {
	return <ProfileLayout role={(await ppicSession())?.role ?? "SUPER_ADMIN"} />;
}
