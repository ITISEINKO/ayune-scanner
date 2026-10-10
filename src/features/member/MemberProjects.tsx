"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSelectProject } from "@/hooks/use-project-selection";
import { useProjects } from "@/hooks/use-projects";

export const ChooseProjectPage = ({
	selectable = true,
}: {
	selectable?: boolean;
}) => {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const selectProject = useSelectProject();
	const {
		data: projects = [],
		isLoading: loading,
		isError: error,
	} = useProjects();
	const visibleProjects = projects.filter((project) =>
		`${project.custom_id ?? ""} ${project.name ?? ""}`
			.toLowerCase()
			.includes(search.trim().toLowerCase()),
	);
	const chooseProject = (taskId: string) => {
		if (selectProject.isPending) return;
		selectProject.mutate(taskId, {
			onSuccess: ({ path }) => router.push(path),
			onError: () => toast.error("Project tidak dapat dipilih. Coba lagi."),
		});
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-8">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-4 pt-6 pb-8 text-accent-foreground">
				<img
					src="/ayune-14.svg"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -top-20 -right-16 z-0 size-70  opacity-10"
				/>
				<div className="relative z-10 flex items-center gap-3">
					<div className="mr-auto">
						<p className="text-md text-muted-foreground/80">Pekerjaan Aktif</p>

						<h1 className="text-2xl text- font-extrabold tracking-tight">
							Pilih project
						</h1>
					</div>
				</div>
				<div className="relative z-10 mt-4">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						aria-label="Cari project"
						placeholder="Cari kode / nama project"
						className="h-11 rounded-2xl border-border bg-card pl-10 shadow-sm"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
			</header>

			<div className="space-y-5 px-4 pt-5">
				<section aria-labelledby="ongoing-projects">
					<div className="mb-4 flex items-center justify-between">
						<h2
							id="ongoing-projects"
							className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase"
						>
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-primary/40"
							/>
							Ongoing
						</h2>
						<Badge
							variant="muted"
							className="h-5 rounded-full px-2 text-[10px]"
						>
							{visibleProjects.length} project
						</Badge>
					</div>
					<div className="space-y-3">
						{visibleProjects.map((project) => (
							<article
								key={project.id}
								className="rounded-[1.35rem] border border-broder/40 bg-card text-card-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
								role={selectable ? "button" : undefined}
								tabIndex={selectable ? 0 : undefined}
								onClick={
									selectable ? () => chooseProject(project.id) : undefined
								}
								onKeyDown={
									selectable
										? (event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													chooseProject(project.id);
												}
											}
										: undefined
								}
							>
								<div className={selectable ? "cursor-pointer p-4" : "p-4"}>
									<div className="flex items-center justify-between gap-3">
										<Badge className="h-6 rounded-md bg-primary px-2 text-[11px] font-bold text-primary-foreground">
											{project.custom_id ?? project.id}
										</Badge>
									</div>
									<h3 className="mt-3 text-[17px] font-extrabold leading-snug tracking-tight">
										{project.name ?? "Tanpa nama"}
									</h3>
									{selectable && (
										<div className="mt-7 flex items-center justify-between">
											<p className="text-sm font-bold">Pilih project ini</p>
											<span
												aria-hidden="true"
												className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
											>
												<ArrowRight aria-hidden="true" />
											</span>
										</div>
									)}
								</div>
							</article>
						))}
						{loading && (
							<p className="text-sm text-muted-foreground">Memuat project...</p>
						)}
						{!loading && !error && !visibleProjects.length && (
							<p className="text-sm text-muted-foreground">
								Tidak ada project ongoing.
							</p>
						)}
						{error && (
							<p className="text-sm text-destructive">
								Project tidak dapat dimuat. Coba lagi.
							</p>
						)}
					</div>
				</section>
			</div>
		</main>
	);
};
