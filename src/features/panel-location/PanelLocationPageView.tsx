import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { panelDisplayName } from "@/lib/panelLocation";
import type { PanelLocationView } from "@/types/panelLocation";
import { PanelLocationViewer } from "./PanelLocationViewer";

export function PanelLocationPageView({
	location,
	preview,
	modelsHref,
}: {
	location: PanelLocationView;
	preview: boolean;
	modelsHref: string;
}) {
	const panel = location.panels.find(
		(item) => item.barcode === location.barcode,
	);
	const title = `${location.projectName}${panel ? ` · ${panel.roomName}` : ""}`;

	return (
		<main className="relative mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-neutral-50 dark:bg-background md:max-w-none">
			<header className="absolute inset-x-3 top-3 z-20 flex min-w-0 items-center gap-2 md:left-6 md:right-auto md:top-6 md:w-[calc(100%-3rem)] md:max-w-2xl">
				<Link
					href={modelsHref}
					className={buttonVariants({
						variant: "outline",
						size: "sm",
						className:
							"h-10 shrink-0 rounded-full border-border/50 bg-card/95 px-3 shadow-sm",
					})}
				>
					<ArrowLeft aria-hidden="true" /> Kembali ke model
				</Link>
				<h1
					title={title}
					className="min-w-0 flex-1 truncate rounded-full border border-border/50 bg-card/95 px-3 py-3 text-center text-[11px] font-bold shadow-sm"
				>
					{title}
				</h1>
			</header>
			<PanelLocationViewer
				{...location}
				immersive
				preview={preview}
				desktopLayout
			/>
			{panel && (
				<section
					aria-label="Informasi panel"
					className="relative z-10 shrink-0 rounded-t-[1.75rem] border-t border-border/60 bg-card px-5 py-4 md:absolute md:bottom-6 md:left-6 md:w-72 md:rounded-2xl md:border md:bg-card/95 md:shadow-lg"
				>
					<h2 className="text-lg font-extrabold leading-snug wrap-anywhere">
						{panelDisplayName(
							panel.panelName,
							panel.panelNumber ? `Panel ${panel.panelNumber}` : "Panel",
						)}
					</h2>
					<p className="mt-1 text-xs text-muted-foreground wrap-anywhere">
						{panel.panelNumber ? `Panel ${panel.panelNumber} · ` : ""}Serial:{" "}
						{location.barcode}
					</p>
				</section>
			)}
		</main>
	);
}
