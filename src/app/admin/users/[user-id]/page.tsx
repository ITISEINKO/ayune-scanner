import { UserDetailPage } from "@/features/profile/UserDetailPage";

export default async function UserDetail({
	params,
}: {
	params: Promise<{ "user-id": string }>;
}) {
	const { "user-id": memberId } = await params;
	return <UserDetailPage memberId={memberId} />;
}
