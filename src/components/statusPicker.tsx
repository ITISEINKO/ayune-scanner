"use client";

import { statusBarangScanOptions } from "@/lib/produksiPanel";

type StatusPickerProps = {
	currentStatus: string;
	selectedStatus?: string;
	onStatusChange?: (status: string) => void;
};

export default function StatusPicker({
	currentStatus,
	selectedStatus,
	onStatusChange,
}: StatusPickerProps) {
	const current = statusBarangScanOptions.findIndex(
		(option) => option.label === currentStatus,
	);
	const selected = statusBarangScanOptions.findIndex(
		(option) => option.key === selectedStatus,
	);

	return (
		<div className="mb-4 rounded-2xl bg-card px-4 pb-2 pt-3.5">
			<div className="mb-1.5 flex items-center justify-between gap-2 border-b border-border pb-2.5">
				<b className="text-[13px] font-bold">Choose new status</b>
				<span className="text-xs text-muted-foreground">Tap to select</span>
			</div>
			<ul className="flex list-none flex-col p-0">
				{statusBarangScanOptions.map((option, index) => {
					const isDone = index < current;
					const isCurrent = index === current;
					const isTarget = index === selected && index !== current;
					return (
						<li
							key={option.key}
							tabIndex={isCurrent ? -1 : 0}
							role="button"
							aria-disabled={isCurrent}
							onClick={() => !isCurrent && onStatusChange?.(option.key)}
							onKeyDown={(event) => {
								if (
									(event.key === "Enter" || event.key === " ") &&
									!isCurrent
								) {
									event.preventDefault();
									onStatusChange?.(option.key);
								}
							}}
							className={[
								"group relative flex items-center gap-3 py-2 font-medium text-muted-foreground",
								isCurrent && "font-bold text-foreground",
								!isCurrent && "cursor-pointer",
								isCurrent && "cursor-default",
							]
								.filter(Boolean)
								.join(" ")}
						>
							{index !== 0 && (
								<span
									className={[
										"absolute left-2.75 -top-3.5 h-7 w-0.5",
										isDone || isCurrent ? "bg-accent " : "bg-border",
									].join(" ")}
								/>
							)}
							<span
								className={[
									"relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold",
									isDone && "border-accent bg-accent text-white",
									!isDone && "bg-card",
									isCurrent && "border-accent text-accent-foreground",
									!isDone && !isCurrent && !isTarget && "border-border",
									isTarget && "border-dashed border-amber-400",
									isCurrent && "shadow-[0_0_4px_1px_var(--accent)]",
								]
									.filter(Boolean)
									.join(" ")}
							>
								{isDone ? "✓" : index + 1}
							</span>
							<span>{option.label}</span>
							{isCurrent && (
								<em className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-semibold not-italic text-white">
									Current
								</em>
							)}
							{isTarget && (
								<em className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold not-italic text-amber-600">
									Move here
								</em>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
