import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const clickUpToken = async () =>
	(await cookies()).get("clickup_access_token")?.value ?? null;

export const requireClickUpToken = async () => {
	if (!(await clickUpToken())) redirect("/login");
};
