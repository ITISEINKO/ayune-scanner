"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
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
					<div className="flex items-center justify-between mb-2">
						<p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
							Project aktif
						</p>
						<Button
							variant="secondary"
							size="icon-sm"
							className="rounded-full"
							disabled={endSelection.isPending}
							onClick={() =>
								endSelection.mutate(undefined, {
									onSuccess: () => router.replace("/projects"),
									onError: () =>
										toast.error("Project aktif tidak dapat diakhiri."),
								})
							}
						>
							<X aria-hidden="true" />
						</Button>
					</div>

					<div className="min-w-0">
						<p className="wrap-break-word text-xl leading-6 max-w-sm font-extrabold tracking-tight">
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
