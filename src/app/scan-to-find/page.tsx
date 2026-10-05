import { ScanToFindPage } from "@/features/ScanToFind";
import { requireClickUpToken } from "@/lib/session";

const ScanToFind = async () => {
	await requireClickUpToken();
	return <ScanToFindPage />;
};

export default ScanToFind;
