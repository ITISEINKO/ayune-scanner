import { TerpasangDigunakanPage } from "@/features/panel/TerpasangDigunakanPage";
import { requirePpicStatusAccess } from "@/lib/session";

const TerpasangDigunakan = async () => {
	await requirePpicStatusAccess("TERPASANG_DIGUNAKAN");
	return <TerpasangDigunakanPage />;
};

export default TerpasangDigunakan;
