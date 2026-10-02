import { cookies } from "next/headers";

export const clickUpToken = async () =>
	(await cookies()).get("clickup_access_token")?.value ?? null;
