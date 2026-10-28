import { notFound } from "next/navigation";
import { UbahManualPage } from "@/features/admin/UbahManualPage";

export const metadata = {
	title: "Lokasi dan status panel | Production Scanner",
};

export default async function ManualPanelLocation({
	searchParams,
}: {
	searchParams: Promise<{ barcode?: string }>;
}) {
	const { barcode } = await searchParams;
	if (typeof barcode !== "string" || !barcode.trim() || barcode.length > 100)
		notFound();
	return <UbahManualPage key={barcode} serialNumber={barcode.trim()} />;
}
