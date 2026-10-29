"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Scanner } from "@/components/scanner";
import { buttonVariants } from "@/components/ui/button";
import { PanelLocationViewer } from "@/features/panel-location/PanelLocationViewer";
import type { PanelLocationView } from "@/types/panelLocation";
import { panelDisplayName } from "@/lib/panelLocation";

export const SearchPanelLocationPage = ({
	serialNumber,
	location,
	errorMessage,
}: {
	serialNumber: string;
	location: PanelLocationView | null;
	errorMessage: string;
}) => {
	const router = useRouter();
	const finding = useRef(false);
	const [searching, startSearch] = useTransition();
	const findPanel = (value: string) => {
		const code = value.trim();
		if (!code || finding.current) return;
		if (code.length > 100) {
			toast.error("Serial number terlalu panjang.");
			return;
		}
		finding.current = true;
		startSearch(() =>
			router.push(`/cari-lokasi?${new URLSearchParams({ barcode: code })}`),
		);
	};
	const panel = location?.panels.find((item) => item.barcode === serialNumber);
	const title = location
		? `${location.projectName}${panel ? ` · ${panel.roomName}` : ""}`
		: "Lokasi panel";

	return (
		<main
			className={
				serialNumber
					? "relative mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-neutral-50 pb-(--bottom-navigation-height) dark:bg-background"
					: "mx-auto min-h-dvh max-w-lg p-4 pb-28"
			}
		>
			{serialNumber ? (
				<header className="absolute inset-x-3 top-3 z-20 flex min-w-0 items-center gap-2">
					<Link
						href="/cari-lokasi"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className:
								"h-10 rounded-full border-border/50 bg-card/95 px-3 shadow-sm",
						})}
					>
						<ArrowLeft aria-hidden="true" /> Scan panel lain
					</Link>
					<h1
						title={title}
						className="min-w-0 flex-1 truncate rounded-full border border-border/50 bg-card/95 px-3 py-3 text-center text-[11px] font-bold shadow-sm"
					>
						{title}
					</h1>
				</header>
			) : (
				<>
					<header className="mb-7">
						<div className="flex items-center gap-4">
							<div className="size-19 shrink-0 overflow-hidden">
								<img src="/icon.svg" alt="" className="size-full" />
							</div>
							<div>
								<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
									Produksi Panel
								</p>
								<h1 className="text-xl font-black tracking-tight">
									Cari lokasi panel
								</h1>
							</div>
						</div>
						<p className="mt-2 text-sm text-muted-foreground">
							Scan atau masukkan serial panel untuk melihat lokasinya.
						</p>
					</header>
					<Scanner onDetected={findPanel} disabled={searching} />
					{searching && (
						<p
							role="status"
							className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
						>
							<LoaderCircle
								aria-hidden="true"
								className="size-4 animate-spin"
							/>
							Mencari lokasi panel…
						</p>
					)}
				</>
			)}
			{errorMessage && (
				<p
					role="alert"
					className="mx-4 mt-20 rounded-xl border bg-card p-5 text-sm"
				>
					{errorMessage}
				</p>
			)}
			{location && (
				<>
					<PanelLocationViewer {...location} immersive />
					<section
						aria-label="Informasi panel"
						className="relative z-10 shrink-0 rounded-t-[1.75rem] border-t border-border/60 bg-card px-5 py-4"
					>
						<h2 className="text-lg font-extrabold leading-snug wrap-anywhere">
							{panelDisplayName(panel?.panelName, panel?.panelNumber ? `Panel ${panel.panelNumber}` : "Panel")}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{panel?.panelNumber ? `Panel ${panel.panelNumber} · ` : ""}Serial:{" "}
							{serialNumber}
						</p>
					</section>
				</>
			)}
		</main>
	);
};
