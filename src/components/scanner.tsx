"use client";

import { useEffect } from "react";
import {
	Camera,
	Flashlight,
	FlashlightOff,
	InfoIcon,
	ScanBarcode,
} from "lucide-react";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
	onDetected: (sku: string) => void;
	autoStart?: boolean;
	disabled?: boolean;
};

export function Scanner({
	onDetected,
	autoStart = false,
	disabled = false,
}: Props) {
	const { start, stop, toggleTorch, refocus, isScanning, torchOn, error } =
		useBarcodeScanner("barcode-reader", onDetected);
	useEffect(() => {
		if (disabled) {
			void stop();
			return;
		}
		if (autoStart) void start();
	}, [autoStart, disabled, start, stop]);

	return (
		<section className="rounded-2xl border border-border/30 bg-card p-4 text-card-foreground shadow-[0_8px_24px_-14px_rgb(31_26_20/0.24)]">
			<div className="mb-3 flex items-center justify-between">
				<div>
					<p className="mb-1.75 mt-0 text-[10px] font-extrabold tracking-[1.1px] text-muted-foreground">
						<span className="mr-1 inline-block size-1.75 rounded-full bg-emerald-400 align-[1px]" />{" "}
						SIAP MEMINDAI
					</p>
					<h2 className="text-xl font-bold">Scan Barcode Barang</h2>
				</div>
				<ScanBarcode
					className="size-7 text-muted-foreground"
					aria-hidden="true"
				/>
			</div>
			<div
				className="relative w-full aspect-[1.9] cursor-pointer overflow-hidden rounded-2xl bg-muted"
				onPointerDown={() => {
					if (!disabled) void (isScanning ? refocus() : start());
				}}
			>
				<div
					id="barcode-reader"
					className="size-full [&_video]:size-full [&_video]:object-cover"
				/>
				<div className="pointer-events-none absolute inset-0 text-[#76695c]">
					<span className="absolute top-7 left-15 size-5 rounded-tl-md border-t-2 border-l-2 border-[#76695c]" />
					<span className="absolute top-7 right-15 size-5 rounded-tr-md border-t-2 border-r-2 border-[#76695c]" />
					<span className="absolute bottom-7 left-15 size-5 rounded-bl-md border-b-2 border-l-2 border-[#76695c]" />
					<span className="absolute right-15 bottom-7 size-5 rounded-br-md border-r-2 border-b-2 border-[#76695c]" />
				</div>
				{!isScanning && (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-center text-sm text-[#76695c]">
						<Camera className="mb-4 size-10" />
						<span>Siap untuk membuka kamera</span>
					</div>
				)}
			</div>
			{error && (
				<Alert variant="destructive" className="mt-3">
					<InfoIcon className="size-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<div className="mt-2 grid grid-cols-[1.28fr_1fr] gap-2.5">
				<Button
					onClick={() => void start()}
					disabled={disabled || isScanning}
					className="h-13 min-h-0 text-sm"
				>
					<Camera className="mr-2 inline size-5" />
					{isScanning ? "Kamera aktif" : "Buka scanner"}
				</Button>
				<Button
					variant="secondary"
					onClick={() => void toggleTorch()}
					disabled={!isScanning}
					aria-label="Toggle flashlight"
					className="h-13 min-h-0"
				>
					{torchOn ? (
						<FlashlightOff className="mx-auto size-5" />
					) : (
						<Flashlight className="mx-auto size-5" />
					)}
				</Button>
			</div>
		</section>
	);
}
