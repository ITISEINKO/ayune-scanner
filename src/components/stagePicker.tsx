"use client";

import { TAHAP_FLOW } from "@/lib/produksi";

type StagePickerProps = {
	currentStage: number;
	selectedStage?: string;
	onStageChange?: (stage: string) => void;
};

export default function StagePicker({
	currentStage,
	selectedStage,
	onStageChange,
}: StagePickerProps) {
	const selectedTarget = TAHAP_FLOW.findIndex(
		(tahap) => tahap.name === selectedStage,
	);

	return (
		<div className="mb-4 rounded-radius  bg-card px-4 pb-2 pt-3.5">
			<div className="mb-1.5 flex items-center justify-between gap-2 border-b border-border pb-2.5">
				<b className="text-[13px] font-bold">Choose new stage</b>

				<span className="text-xs text-muted-foreground">Tap to select</span>
			</div>

			{/* Stages */}
			<ul className="flex list-none flex-col p-0">
				{TAHAP_FLOW.map((tahap, index) => {
					const isDone = index < currentStage;
					const isCurrent = index === currentStage;
					const isTarget = index === selectedTarget && index !== currentStage;

					const number = isDone ? "✓" : index + 1;

					return (
						<li
							key={tahap.id}
							tabIndex={isCurrent ? -1 : 0}
							role="button"
							aria-disabled={isCurrent}
							onClick={() => {
								if (isCurrent) return;
								onStageChange?.(tahap.name);
							}}
							onKeyDown={(e) => {
								if ((e.key === "Enter" || e.key === " ") && !isCurrent) {
									e.preventDefault();
									onStageChange?.(tahap.name);
								}
							}}
							className={[
								"group relative flex items-center gap-3 py-2 font-medium",
								"text-muted-foreground",
								isCurrent && "font-bold text-foreground",
								!isCurrent && "cursor-pointer",
								isCurrent && "cursor-default",
							]
								.filter(Boolean)
								.join(" ")}
						>
							{/* Connecting line */}
							{index !== 0 && (
								<span
									className={[
										"absolute left-2.75 -top-3.5 h-7 w-0.5",
										isDone || isCurrent ? "bg-primary" : "bg-border",
									].join(" ")}
								/>
							)}

							{/* Number */}
							<span
								className={[
									"relative z-10 grid h-6 w-6 shrink-0 place-items-center",
									"rounded-full border-2 bg-card",
									"text-[11px] font-bold",
									isDone && "border-primary bg-primary text-white",
									isCurrent && "border-primary text-accent-foreground",
									!isDone && !isCurrent && !isTarget && "border-border",
									isTarget && "border-dashed border-amber-400",
									isCurrent && "shadow-[0_0_4px_4px_var(--accent)]",
								]
									.filter(Boolean)
									.join(" ")}
							>
								{number}
							</span>

							{/* Stage name */}
							<span>{tahap.name}</span>

							{/* Status badge */}
							{isCurrent && (
								<em className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-semibold not-italic text-accent-foreground">
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
