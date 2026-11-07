import { PanelLocationLoader } from "@/features/panel-location/PanelLocationLoader";

export default function LoadingPanelLocation() {
	return (
		<main className="flex min-h-dvh bg-background">
			<PanelLocationLoader message="Memuat posisi panel..." />
		</main>
	);
}
