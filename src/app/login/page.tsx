import LoginPage from "@/features/login";

export default async function Login({ searchParams }: PageProps<"/login">) {
	const { error } = await searchParams;
	return <LoginPage error={typeof error === "string" ? error : undefined} />;
}
