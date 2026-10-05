import { redirect } from "next/navigation";
import { clickUpToken } from "@/lib/session";

export default async function Home() {
	redirect((await clickUpToken()) ? "/manual-status-scan" : "/login");
}
