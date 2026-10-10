"use client";

import { useRouter } from "next/navigation";
import { OctagonX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEndProjectSelection } from "@/hooks/use-project-selection";
import type { SelectedProject } from "@/types/project";

export function ProjectScope({ project }: { project: SelectedProject }) {
	const router = useRouter();
	const endSelection = useEndProjectSelection();
	return (
		<section className="relative  overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-7 py-8">
			<img
				src="/ayune-14.svg"
				alt=""
				aria-hidden="true"
				className="pointer-events-none absolute top-3 -right-10 size-56 opacity-5"
			/>
			<div className="relative z-10">
				<div className="items-start justify-between gap-3">
					<Button
						variant="outline"
						size="sm"
						className="h-8 rounded-xl px-3 text-xs font-normal"
						disabled={endSelection.isPending}
						onClick={() =>
							endSelection.mutate(undefined, {
								onSuccess: () => router.replace("/projects"),
								onError: () =>
									toast.error("Project aktif tidak dapat diakhiri."),
							})
						}
					>
						End Scan
						<OctagonX
							aria-hidden="true"
							className="size-4 text-muted-foreground"
						/>
					</Button>
					<div className="min-w-0">
						<p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
							Project aktif
						</p>
						<p className="wrap-break-word text-xl leading-6 font-extrabold tracking-tight">
							{project.name ?? project.custom_id ?? project.task_id}
						</p>
						{project.name && (
							<p className="mt-1 text-xs font-medium text-muted-foreground">
								{project.custom_id ?? project.task_id}
							</p>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
