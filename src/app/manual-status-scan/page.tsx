import { ManualStatusScanPage } from "@/features/ManualStatusScan";
import { requireClickUpToken } from "@/lib/session";

export default async function ScannerPage() {
	await requireClickUpToken();
	return <ManualStatusScanPage />;
}
