import { getPpicProfile } from "@/lib/db";
import { getAppSession, getClickUpIdentity } from "@/lib/session";

export async function getProfile() {
	const [identity, session] = await Promise.all([getClickUpIdentity(), getAppSession()]);
	const profile = identity ? await getPpicProfile(identity.user_id) : null;
	return {
		email: profile?.email ?? null,
		displayName: profile?.displayName ?? null,
		role: session?.role ?? null,
		allowedStatuses: session?.allowed_status ?? null,
	};
}
