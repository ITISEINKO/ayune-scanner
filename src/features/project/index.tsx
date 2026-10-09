"use client";

import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import type { ClickUpTask } from "@/types/clickup";

export const ChooseProjectPage = () => {
	const [projects, setProjects] = useState<ClickUpTask[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		void fetch("/api/projects", { cache: "no-store" })
			.then(async (response) => {
				const result = (await response.json()) as { tasks?: ClickUpTask[] };
				if (!response.ok) throw new Error();
				setProjects(result.tasks ?? []);
			})
			.catch(() => setError(true))
			.finally(() => setLoading(false));
	}, []);

	return (
		<main className="mx-auto min-h-dvh max-w-lg pb-8">
			<header className="flex items-center justify-between border-b bg-card px-4 py-3">
				<Link
					href="/"
					aria-label="Kembali"
					className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
				>
					<ChevronLeft aria-hidden="true" className="size-5" />
				</Link>
				<h1 className="mr-auto text-lg font-extrabold">Pilih project</h1>
				<div
					aria-label="Pengguna B"
					className="flex size-9 items-center justify-center rounded-full border bg-background text-sm font-bold"
				>
					B
				</div>
			</header>

			<div className="space-y-5 p-4">
				<div className="relative">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						aria-label="Cari project"
						placeholder="Cari kode / nama project"
						className="pl-10"
					/>
				</div>

				<section aria-labelledby="ongoing-projects">
					<h2
						id="ongoing-projects"
						className="mb-3  text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase"
					>
						Ongoing · {projects.length} project
					</h2>
					<div className="space-y-3">
						{projects.map((project) => (
							<article
								key={project.id}
								className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm"
							>
								<div className="text-sm font-semibold">
									{project.custom_id ?? project.id}
								</div>
								<h3 className="mt-3 font-bold leading-snug">
									{project.name ?? "Tanpa nama"}
								</h3>
							</article>
						))}
						{loading && (
							<p className="text-sm text-muted-foreground">Memuat project...</p>
						)}
						{!loading && !error && !projects.length && (
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

				<p className="border-l-2 border-accent pl-3 text-sm leading-6 text-muted-foreground">
					Pilihan disimpan. Buka app lagi = langsung ke scanner.
				</p>
			</div>
		</main>
	);
};
