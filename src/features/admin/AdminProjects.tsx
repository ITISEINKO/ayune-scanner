"use client";

import Link from "next/link";
import { ArrowRight, Check, Play, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import type { ClickUpTask } from "@/types/clickup";

export const AdminProjects = () => {
	const [search, setSearch] = useState("");
	const [tab, setTab] = useState<"in progress" | "to do">("in progress");
	const [selectedProject, setSelectedProject] = useState<ClickUpTask | null>(
		null,
	);
	const [starting, setStarting] = useState(false);
	const [startError, setStartError] = useState("");
	const queryClient = useQueryClient();
	const {
		data: projects = [],
		isLoading: loading,
		isFetching,
		isError: error,
		sync,
	} = useProjects(tab);
	const visibleProjects = projects.filter((project) =>
		`${project.custom_id ?? ""} ${project.name ?? ""}`
			.toLowerCase()
			.includes(search.trim().toLowerCase()),
	);
	const syncProjects = () =>
		void sync().catch(() =>
			toast.error("Project tidak dapat diperbarui. Coba lagi."),
		);
	const confirmStart = async () => {
		if (!selectedProject || starting) return;
		setStarting(true);
		setStartError("");
		try {
			const response = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ task_id: selectedProject.id }),
			});
			if (!response.ok || response.redirected) throw new Error("start");
			const { task } = (await response.json()) as { task: ClickUpTask };
			await queryClient.cancelQueries({ queryKey: ["projects"] });
			queryClient.setQueryData<ClickUpTask[]>(["projects", "to do"], (tasks) =>
				tasks?.filter((project) => project.id !== task.id),
			);
			queryClient.setQueryData<ClickUpTask[]>(["projects"], (tasks = []) => [
				...tasks.filter((project) => project.id !== task.id),
				task,
			]);
			setSelectedProject(null);
			setTab("in progress");
			toast.success("Project berhasil dimulai.");
		} catch {
			setStartError(
				"Project belum dapat dikonfirmasi. Coba lagi atau gunakan Sync untuk memeriksa status ClickUp.",
			);
		} finally {
			setStarting(false);
		}
	};

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-24">
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

			<Tabs
				value={tab}
				onValueChange={(value) => setTab(value as typeof tab)}
				className="space-y-5 px-4 pt-5"
			>
				<TabsList className="w-full" aria-label="Status project">
					<TabsTrigger value="in progress">In progress</TabsTrigger>
					<TabsTrigger value="to do">Todo</TabsTrigger>
				</TabsList>
				<TabsContent value={tab}>
					<p className="mb-4 text-sm text-muted-foreground">
						{tab === "in progress"
							? "Project yang sedang dikerjakan. Pilih project untuk melihat detail dan progresnya."
							: "Project yang belum dimulai. Klik Mulai agar petugas bisa memilih project dan mulai scan."}
					</p>
					<div className="mb-4 flex items-center justify-between">
						<h2
							id="ongoing-projects"
							className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase"
						>
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-primary/40"
							/>
							{tab === "in progress" ? "Ongoing" : "Todo"}
						</h2>
						<Badge
							variant="muted"
							className="h-5 rounded-full px-2 text-[10px]"
						>
							{visibleProjects.length} project
						</Badge>
					</div>
					<div className="space-y-3">
						{visibleProjects.map((project) => {
							if (tab === "to do") return (
								<article key={project.id} className="rounded-[1.35rem] border border-border/40 bg-card p-4 text-card-foreground">
									<div className="min-w-0">
										<Badge className="h-auto min-h-6 max-w-full rounded-md bg-primary px-2 py-1 text-[11px] font-bold whitespace-normal text-primary-foreground">
											<span className="wrap-anywhere">{project.custom_id ?? project.id}</span>
										</Badge>
										<h3 className="mt-3 text-[17px] leading-snug font-extrabold tracking-tight wrap-anywhere">
											{project.name ?? "Tanpa nama"}
										</h3>
										<p className="mt-1 text-sm text-muted-foreground">
											Belum dimulai
										</p>
									</div>
									<Button
										className="mt-4 min-h-14 w-full gap-2 rounded-2xl bg-accent text-base text-white hover:bg-accent/80"
										aria-label={`Mulai project ${project.name ?? project.custom_id ?? project.id}`}
										onClick={() => {
											setStartError("");
											setSelectedProject(project);
										}}
									>
										<Play aria-hidden="true" />
										Mulai project
									</Button>
								</article>
							);
							const className =
								"block w-full text-left rounded-[1.35rem] border border-border/40 bg-card text-card-foreground transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30";
							const content = (
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
							);
							return (
								<Link
									key={project.id}
									href={`/admin/project?task_id=${encodeURIComponent(project.id)}`}
									className={className}
								>
									{content}
								</Link>
							);
						})}
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
								Tidak ada project {tab === "in progress" ? "ongoing" : "todo"}.
							</p>
						)}
						{error && (
							<p className="text-sm text-destructive">
								Project tidak dapat dimuat. Coba lagi.
							</p>
						)}
					</div>
				</TabsContent>
			</Tabs>
			<Dialog
				open={!!selectedProject}
				onOpenChange={(open) => {
					if (!open && !starting) setSelectedProject(null);
				}}
			>
				<DialogContent
					showCloseButton={!starting}
					className="top-auto bottom-0 max-h-dvh max-w-lg translate-y-0 gap-4 overflow-y-auto rounded-b-none bg-background p-4 pt-7 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-b-3xl"
				>
					<span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-border sm:hidden" />
					<DialogTitle className="pr-10 text-xl leading-snug font-extrabold wrap-anywhere">
						Mulai {selectedProject?.name ?? selectedProject?.custom_id ?? selectedProject?.id}?
					</DialogTitle>
					<DialogDescription className="space-y-2 text-foreground">
						<span className="flex items-start gap-3 rounded-2xl bg-card p-3">
							<Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
							<span>Status project di ClickUp berubah jadi <strong>In Progress.</strong></span>
						</span>
						<span className="flex items-start gap-3 rounded-2xl bg-card p-3">
							<Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
							<span>Petugas langsung bisa memilih project ini dan mulai scan.</span>
						</span>
					</DialogDescription>
					{startError && (
						<p role="alert" className="text-sm text-destructive">
							{startError}
						</p>
					)}
					<DialogFooter className="-mx-4 -mb-4 grid grid-cols-2 border-t border-border px-4 py-3 sm:grid">
						<Button
							variant="outline"
							className="rounded-2xl bg-card"
							disabled={starting}
							onClick={() => setSelectedProject(null)}
						>
							Nanti dulu
						</Button>
						<Button
							className="rounded-2xl bg-accent text-accent-foreground hover:bg-accent/80"
							disabled={starting}
							onClick={() => void confirmStart()}
						>
							{starting ? "Memulai..." : "Ya, mulai"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
};
