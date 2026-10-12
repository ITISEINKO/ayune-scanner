"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";

export const AdminProjects = () => {
	const [search, setSearch] = useState("");
	const {
		data: projects = [],
		isLoading: loading,
		isFetching,
		isError: error,
		sync,
	} = useProjects();
	const visibleProjects = projects.filter((project) =>
		`${project.custom_id ?? ""} ${project.name ?? ""}`
			.toLowerCase()
			.includes(search.trim().toLowerCase()),
	);
	const syncProjects = () => void sync();

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-8">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-8 text-accent-foreground">
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
					<Button
						variant="secondary"
						size="sm"
						onClick={syncProjects}
						disabled={isFetching}
					>
						<RefreshCw className={isFetching ? "animate-spin" : ""} />
						Sync
					</Button>
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
							<Link
								key={project.id}
								href={`/admin/project?task_id=${encodeURIComponent(project.id)}`}
								className="block rounded-[1.35rem] border border-border/40 bg-card text-card-foreground transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
							>
								<div className="p-4">
									<div className="flex items-center justify-between gap-3">
										<Badge className="h-6 rounded-md bg-primary px-2 text-[11px] font-bold text-primary-foreground">
											{project.custom_id ?? project.id}
										</Badge>
									</div>
									<h3 className="mt-3 text-[17px] font-extrabold leading-snug tracking-tight">
										{project.name ?? "Tanpa nama"}
									</h3>
									<div className="mt-7 flex items-center justify-between">
										<p className="text-sm font-bold">Lihat detail project</p>
										<span
											aria-hidden="true"
											className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
										>
											<ArrowRight aria-hidden="true" />
										</span>
									</div>
								</div>
							</Link>
						))}
						{loading &&
							Array.from({ length: 3 }, (_, index) => (
								<article
									key={index}
									aria-hidden="true"
									className="rounded-[1.35rem] border border-border/40 bg-card/50 p-4"
								>
									<Skeleton className="h-6 w-20 rounded-md" />
									<Skeleton className="mt-3 h-10 w-4/5" />
									<div className="mt-7 flex items-center justify-between">
										<Skeleton className="h-5 w-36" />
										<Skeleton className="size-8 rounded-full" />
									</div>
								</article>
							))}
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
