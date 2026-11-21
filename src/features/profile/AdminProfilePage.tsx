import { ProfileLayout } from "@/features/profile";
import { ppicSession } from "@/lib/session";
import { canImportLby } from "@/lib/db";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export async function AdminProfilePage() {
	const session = await ppicSession();
	return <ProfileLayout role={session?.role ?? "SUPER_ADMIN"}></ProfileLayout>;
}
