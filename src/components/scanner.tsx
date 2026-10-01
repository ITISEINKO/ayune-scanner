"use client";

import { useEffect } from "react";
import { Camera, Flashlight, FlashlightOff, ScanBarcode } from "lucide-react";
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
		<section className="rounded-3xl border border-border bg-card p-4 text-card-foreground shadow-2xl">
			<div className="mb-3 flex items-center justify-between">
				<div>
					<p className="mb-1.75 mt-0 text-[10px] font-extrabold tracking-[1.1px] text-muted-foreground">
						<span className="mr-1 inline-block size-1.75 rounded-full bg-emerald-400 align-[1px]" />{" "}
						SIAP MEMINDAI
					</p>
					<h2 className="text-xl font-bold">Scan barcode barang</h2>
				</div>
				<ScanBarcode
					className="size-7 text-muted-foreground"
					aria-hidden="true"
				/>
			</div>
			<div
				className="relative min-h-64 cursor-pointer overflow-hidden rounded-2xl bg-muted"
				onPointerDown={() => void refocus()}
			>
				<div id="barcode-reader" className="min-h-64" />
				{!isScanning && (
					<div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
						<Camera className="mx-auto mb-2 size-10" />
						<span>Siap untuk membuka kamera</span>
					</div>
				)}
			</div>
			{error && (
				<Alert variant="destructive" className="mt-3">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<div className="mt-4 grid grid-cols-2 gap-3">
				<Button
					onClick={() => void start()}
					disabled={disabled || isScanning}
					className="text-base"
				>
					<Camera className="mr-2 inline size-5" />
					{isScanning ? "Kamera aktif" : "Buka scanner"}
				</Button>
				<Button
					variant="secondary"
					onClick={() => void toggleTorch()}
					disabled={!isScanning}
					aria-label="Toggle flashlight"
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
