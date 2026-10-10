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
		<div className="mb-5 rounded-2xl border-0 bg-white px-4 py-4 shadow-md">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-xs tracking-[0.08em] text-muted-foreground uppercase">
						<span
							aria-hidden="true"
							className="size-2 rounded-full bg-emerald-500"
						/>
						Project aktif
					</p>
					<p className="truncate text-[22px] leading-7 font-extrabold">
						{project.custom_id ?? project.task_id}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="h-9 rounded-xl px-3 font-normal"
					disabled={endSelection.isPending}
					onClick={() =>
						endSelection.mutate(undefined, {
							onSuccess: () => router.replace("/projects"),
							onError: () => toast.error("Project aktif tidak dapat diakhiri."),
						})
					}
				>
					End Scan
					<X aria-hidden="true" className="size-4 text-muted-foreground" />
				</Button>
			</div>
			{project.name && (
				<p className="mt-3 border-t border-border/60 pt-3 text-sm leading-6 text-foreground uppercase">
					{project.name}
				</p>
			)}
		</div>
	);
}
