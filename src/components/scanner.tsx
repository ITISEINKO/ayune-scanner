"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Camera,
	BadgeCheck,
	ChevronDown,
	Flashlight,
	FlashlightOff,
	InfoIcon,
	Keyboard,
	Package,
	PackageCheck,
	RotateCcw,
	ScanBarcode,
} from "lucide-react";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PpicStatus, PpicStatuses } from "@/types/ppic";

type Props = {
	onDetected: (sku: string, status?: PpicStatus) => void;
	autoStart?: boolean;
	disabled?: boolean;
	statuses?: PpicStatuses;
	selectedStatus?: PpicStatus;
	onStatusChange?: (status: PpicStatus) => void;
};

type ScanMode = "camera" | "keyboard";

const statusOptions = [
	{
		status: "BARANG_DITERIMA",
		label: "Barang Diterima",
		icon: PackageCheck,
		variant: "green",
		className: "bg-emerald-100 text-emerald-700",
	},
	{
		status: "SEDANG_DIPACKING",
		label: "Sedang Dipacking",
		icon: Package,
		variant: "blue",
		className: "bg-blue-100 text-blue-700",
	},
	{
		status: "TERPASANG_DIGUNAKAN",
		label: "Terpasang / Digunakan",
		icon: BadgeCheck,
		variant: "purple",
		className: "bg-violet-100 text-violet-700",
	},
	{
		status: "DALAM_PROSES_RETUR",
		label: "Dalam Proses Retur",
		icon: RotateCcw,
		variant: "destructive",
		className: "bg-red-100 text-red-700",
	},
] as const;

export function Scanner({
	onDetected,
	autoStart = false,
	disabled = false,
	statuses,
	selectedStatus,
	onStatusChange,
}: Props) {
	const [mode, setMode] = useState<ScanMode>("camera");
	const selectedStatusOption = statusOptions.find(
		(option) => option.status === selectedStatus,
	);
	const keyboardBuffer = useRef("");
	const keyboardInput = useRef<HTMLInputElement>(null);
	const keyboardSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const handleDetected = useCallback(
		(value: string) => onDetected(value.replace(/♪+$/g, "")),
		[onDetected],
	);
	const { start, stop, toggleTorch, refocus, isScanning, torchOn, error } =
		useBarcodeScanner("barcode-reader", handleDetected);
	const submitKeyboardValue = useCallback(() => {
		if (keyboardSubmitTimer.current) clearTimeout(keyboardSubmitTimer.current);
		const value = (
			keyboardBuffer.current ||
			keyboardInput.current?.value ||
			""
		).trim();
		keyboardBuffer.current = "";
		if (keyboardInput.current) keyboardInput.current.value = "";
		if (value) handleDetected(value);
	}, [handleDetected]);
	useEffect(() => {
		if (disabled || mode === "keyboard") {
			void stop();
			return;
		}
		if (autoStart) void start();
	}, [autoStart, disabled, mode, start, stop]);

	useEffect(() => {
		if (mode !== "keyboard" || disabled) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.isComposing ||
				event.ctrlKey ||
				event.altKey ||
				event.metaKey ||
				(event.target instanceof HTMLElement && event.target.isContentEditable)
			)
				return;

			if (event.key === "Enter") {
				const value = keyboardBuffer.current.replace(/♪+$/g, "");
				keyboardBuffer.current = "";
				if (keyboardInput.current) keyboardInput.current.value = "";
				if (value) {
					event.preventDefault();
					handleDetected(value);
				}
				return;
			}

			// Barcode scanners send printable characters; ignore icons and control keys.
			if (event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key))
				keyboardBuffer.current += event.key;
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [disabled, handleDetected, mode]);

	useEffect(() => {
		keyboardBuffer.current = "";
		if (mode === "keyboard" && !disabled) keyboardInput.current?.focus();
	}, [mode, disabled]);

	useEffect(
		() => () => {
			if (keyboardSubmitTimer.current)
				clearTimeout(keyboardSubmitTimer.current);
		},
		[],
	);

	return (
		<section className="rounded-2xl border border-border/30 bg-card p-4 text-card-foreground shadow-[0_8px_24px_-14px_rgb(31_26_20/0.24)]">
			<div className="mb-3 flex items-center justify-between">
				<div>
					<p className="mb-1.75 mt-0 text-[10px] font-extrabold tracking-[1.1px] text-muted-foreground">
						<span className="mr-1 inline-block size-1.75 rounded-full bg-emerald-400 align-[1px]" />{" "}
						{statuses && !selectedStatus ? "PILIH STATUS" : "SIAP MEMINDAI"}
					</p>
				</div>
				<ScanBarcode
					className="size-7 text-muted-foreground"
					aria-hidden="true"
				/>
			</div>
			<p className="px-2 mb-2 shrink-0 text-xs font-medium text-muted-foreground">
				Status Barang Scan
			</p>
			{statuses && (
				<div className="mb-3 flex items-center gap-3">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="outline"
									aria-label="Choose scan status"
									className={`h-11 min-w-0 flex-1 justify-start border-0 font-semibold ${selectedStatusOption?.className ?? "bg-background"}`}
								/>
							}
						>
							{selectedStatusOption ? (
								<>
									<selectedStatusOption.icon />
									<span>{selectedStatusOption.label}</span>
									<ChevronDown className="ml-auto" />
								</>
							) : (
								<>
									<span>Pilih status sebelum scan</span>
									<ChevronDown className="ml-auto" />
								</>
							)}
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuRadioGroup
								value={selectedStatus ?? ""}
								onValueChange={(value) => {
									const status = statuses.find((item) => item === value);
									if (status) onStatusChange?.(status);
								}}
							>
							{statuses.flatMap((status) => {
								const option = statusOptions.find(
									(item) => item.status === status,
								);
								if (!option) return [];
								const Icon = option.icon;
								return (
									<DropdownMenuRadioItem key={status} value={status} closeOnClick>
										<Badge variant={option.variant}>
											<Icon />
											{option.label}
										</Badge>
									</DropdownMenuRadioItem>
								);
							})}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			)}
			<div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
				<Button
					variant={mode === "camera" ? "default" : "ghost"}
					onClick={() => setMode("camera")}
					disabled={disabled}
					className="h-10 min-h-0"
				>
					<Camera className="mr-2 size-4" /> Kamera
				</Button>
				<Button
					variant={mode === "keyboard" ? "default" : "ghost"}
					onClick={() => setMode("keyboard")}
					disabled={disabled}
					className="h-10 min-h-0"
				>
					<Keyboard className="mr-2 size-4" /> Keyboard
				</Button>
			</div>
			<div
				className={`relative w-full aspect-[1.9] overflow-hidden rounded-2xl bg-muted ${mode === "camera" ? "cursor-pointer" : ""}`}
				onPointerDown={() => {
					if (mode === "camera" && !disabled)
						void (isScanning ? refocus() : start());
				}}
			>
				<div
					id="barcode-reader"
					className="size-full [&_video]:size-full [&_video]:object-cover"
				/>

				{mode === "keyboard" ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[#76695c]">
						<Keyboard className="mb-4 size-10" />
						<input
							ref={keyboardInput}
							aria-label="Input scan keyboard"
							placeholder="Klik di sini, lalu scan barcode"
							className="h-11 w-full rounded-xl border border-border bg-background px-3 text-center text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
							onInput={() => {
								if (keyboardSubmitTimer.current)
									clearTimeout(keyboardSubmitTimer.current);
								keyboardSubmitTimer.current = setTimeout(
									submitKeyboardValue,
									150,
								);
							}}
							onBlur={(event) => {
								event.currentTarget.placeholder =
									"Klik di sini untuk mengaktifkan scanner";
							}}
							onFocus={(event) => {
								event.currentTarget.placeholder =
									"Siap menerima scan dari keyboard";
							}}
						/>
					</div>
				) : !isScanning ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-center text-sm text-[#76695c]">
						<Camera className="mb-4 size-10" />
						<span>Siap untuk membuka kamera</span>
					</div>
				) : null}
			</div>
			{error && (
				<Alert variant="destructive" className="mt-3">
					<InfoIcon className="size-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			{mode === "camera" && (
				<div className="mt-2 grid grid-cols-[1fr_auto] gap-2.5">
					<Button
						onClick={() => void start()}
						disabled={disabled || isScanning}
						className="h-13 w-full min-h-0 text-sm"
					>
						<Camera className="mr-2 inline size-5" />
						{isScanning ? "Kamera aktif" : "Buka scanner"}
					</Button>
					<Button
						variant="secondary"
						onClick={() => void toggleTorch()}
						disabled={!isScanning}
						aria-label="Toggle flashlight"
						className="h-13 w-13 min-h-0 justify-self-end"
					>
						{torchOn ? (
							<FlashlightOff className="mx-auto size-5" />
						) : (
							<Flashlight className="mx-auto size-5" />
						)}
					</Button>
				</div>
			)}
		</section>
	);
}
