import { redirect } from "next/navigation";
import { postLoginPath } from "@/lib/session";

export default async function Home() {
	redirect(await postLoginPath());
}
