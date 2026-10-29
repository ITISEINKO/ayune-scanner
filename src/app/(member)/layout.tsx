import { BottomNavigation } from "@/components/bottomNavigation";
import { SessionRefresh } from "@/components/sessionRefresh";
import { PPIC_SESSION_REFRESH_TTL_MS, ppicSession } from "@/lib/session";

export default async function MemberLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await ppicSession();

	return (
		<>
			{children}
			<SessionRefresh
				refreshAfter={Math.max(
					0,
					PPIC_SESSION_REFRESH_TTL_MS -
						(Date.now() - (session?.refreshed_at ?? 0)),
				)}
				refreshedAt={session?.refreshed_at ?? 0}
				userId={session?.user_id ?? null}
			/>
			<BottomNavigation role={session?.role ?? null} workspace={session?.can_import_lby ? "drafter" : undefined} />
		</>
	);
}
