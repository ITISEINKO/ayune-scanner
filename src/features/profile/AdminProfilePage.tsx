import { ProfileLayout } from "@/features/profile";
import { ppicSession } from "@/lib/session";
import { canImportLby } from "@/lib/db";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export async function AdminProfilePage() {
	const session = await ppicSession();
	const canImport = session ? await canImportLby(session.user_id) : false;
	return (
		<ProfileLayout role={session?.role ?? "SUPER_ADMIN"}>
			{canImport && (
				<section
					className="mx-4 mt-6 rounded-2xl border bg-card p-4 space-y-3"
					aria-label="Lokasi panel LBY"
				>
					<h2 className="font-bold">Lokasi panel LBY</h2>
					<p className="text-sm text-muted-foreground">
						Tambahkan link model LBY. Panel dicocokkan lewat board number /
						serial number, tanpa memilih project ClickUp.
					</p>
					<Link href="/admin/import-3d" className={buttonVariants({ variant: "outline", className: "w-full" })}>Kelola model LBY</Link>
				</section>
			)}
		</ProfileLayout>
	);
}
