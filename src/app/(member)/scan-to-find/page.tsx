import { ScanToFindPage } from "@/features/ScanToFind";
import { ppicSession, requireClickUpToken } from "@/lib/session";

const ScanToFind = async () => {
	await requireClickUpToken();
	const session = await ppicSession();
	return <ScanToFindPage role={session?.role ?? "MEMBER"} />;
};

export default ScanToFind;
