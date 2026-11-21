import { ProfileLayout } from "@/features/profile";
import { getAppSession } from "@/lib/session";
import { getProfile } from "@/features/profile/getProfile";

export default async function DrafterProfile() {
	const session = await getAppSession();
	return (
		<ProfileLayout
			role={session?.role ?? "MEMBER"}
			initialProfile={await getProfile()}
			roleLabel={session?.role === "MEMBER" ? "Drafter" : undefined}
		>
			<section className="mx-4 mt-6 rounded-2xl border bg-card p-4">
				<h2 className="font-bold">Akses model LBY</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					Import, preview, dan aktifkan model. Akses scan barang diatur terpisah
					oleh admin.
				</p>
			</section>
		</ProfileLayout>
	);
}
