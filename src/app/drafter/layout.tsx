import { redirect } from "next/navigation";
import { canImportLby } from "@/lib/db";
import { ppicSession, requireClickUpToken, PPIC_SESSION_REFRESH_TTL_MS } from "@/lib/session";
import { BottomNavigation } from "@/components/bottomNavigation";
import { SessionRefresh } from "@/components/sessionRefresh";

export default async function DrafterLayout({ children }: { children: React.ReactNode }) {
	await requireClickUpToken();
	const session = await ppicSession();
	if (!session) redirect("/login");
	if (!(await canImportLby(session.user_id))) redirect("/unauthorized");
	return <>
		{children}
		<SessionRefresh userId={session.user_id} refreshedAt={session.refreshed_at}
			refreshAfter={Math.max(0, PPIC_SESSION_REFRESH_TTL_MS - (Date.now() - session.refreshed_at))} />
		<BottomNavigation role={session.role} workspace="drafter" />
	</>;
}
