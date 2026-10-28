import { ProfileLayout } from "@/features/profile";
import { ppicSession } from "@/lib/session";
import { getPpicAccess } from "@/lib/db";
import { LbyImportDialog } from "@/features/admin/LbyImportDialog";

export async function AdminProfilePage() {
	const session = await ppicSession();
	const canImport =
		session?.role === "ADMIN" &&
		(await getPpicAccess(session.user_id))?.role === "ADMIN";
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
					<LbyImportDialog />
				</section>
			)}
		</ProfileLayout>
	);
}
