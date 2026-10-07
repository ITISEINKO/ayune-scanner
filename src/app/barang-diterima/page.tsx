import { BarangDiterimaPage } from "@/features/panel/BarangDiterimaPage";
import { requirePpicStatusAccess } from "@/lib/session";

const BarangDIterima = async () => {
	await requirePpicStatusAccess("BARANG_DITERIMA");
	return <BarangDiterimaPage />;
};

export default BarangDIterima;
