import { AutoScanPage } from "@/features/AutoStatusScan";
import { requireClickUpToken } from "@/lib/session";

const AutoScan = async () => {
	await requireClickUpToken();
	return <AutoScanPage />;
};

export default AutoScan;
