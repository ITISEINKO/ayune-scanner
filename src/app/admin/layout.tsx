import { BottomNavigation } from "@/components/bottomNavigation";
import { SessionRefresh } from "@/components/sessionRefresh";
import {
	SESSION_REFRESH_TTL_MS,
	getAppSession,
	requireSuperAdmin,
} from "@/lib/session";

export default async function AdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	await requireSuperAdmin();
	const session = await getAppSession();

	return (
		<>
			{children}
			<SessionRefresh
				refreshAfter={Math.max(
					0,
					SESSION_REFRESH_TTL_MS -
						(Date.now() - (session?.refreshed_at ?? 0)),
				)}
				refreshedAt={session?.refreshed_at ?? 0}
				userId={session?.user_id ?? null}
			/>
			<BottomNavigation role={session?.role ?? "SUPER_ADMIN"} />
		</>
	);
}
