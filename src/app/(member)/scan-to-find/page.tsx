import { ScanToFindPage } from "@/features/ScanToFind";
import { getAppSession, requireClickUpToken } from "@/lib/session";

const ScanToFind = async () => {
	await requireClickUpToken();
	const session = await getAppSession();
	return <ScanToFindPage role={session?.role ?? "MEMBER"} />;
};

export default ScanToFind;
