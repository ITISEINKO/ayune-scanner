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
			{(!session ||
				Date.now() - session.refreshed_at >= PPIC_SESSION_REFRESH_TTL_MS) && (
				<SessionRefresh />
			)}
			<BottomNavigation
				role={session?.role ?? null}
				allowedStatus={session?.allowed_status ?? null}
			/>
		</>
	);
}
