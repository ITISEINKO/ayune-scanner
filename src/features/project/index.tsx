import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const projects = [
	{
		code: "AY-4272",
		name: "Apartement Skyhouse B1-27D (Laundry)",
		progress: 51,
		waiting: 2,
	},
	{
		code: "AY-3663",
		name: "Ruko ALGT 7 (Lt.1)",
		progress: 23,
		waiting: 4,
	},
	{
		code: "AY-10712",
		name: "Dalton Utara 17/18 (Lemari Display Lt.1)",
		progress: 27,
		waiting: 1,
	},
	{
		code: "AY-9349",
		name: "Amethyst Timur 58 (Dapur)",
		progress: 61,
		waiting: 1,
	},
];

export const ChooseProjectPage = () => {
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
								key={project.code}
								className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm"
							>
								<div className="flex items-baseline justify-between gap-4  text-sm font-semibold">
									<span>{project.code}</span>
									<span className="font-medium text-muted-foreground">
										{project.progress}%
									</span>
								</div>
								<h3 className="mt-3 font-bold leading-snug">{project.name}</h3>
								<div
									role="progressbar"
									aria-label={`Progress ${project.name}`}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-valuenow={project.progress}
									className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
								>
									<div
										className="h-full rounded-full bg-primary"
										style={{ width: `${project.progress}%` }}
									/>
								</div>
								<p className="mt-3 text-sm font-semibold">
									{project.waiting} nunggu di Edging
								</p>
							</article>
						))}
					</div>
				</section>

				<p className="border-l-2 border-accent pl-3 text-sm leading-6 text-muted-foreground">
					Pilihan disimpan. Buka app lagi = langsung ke scanner.
				</p>
			</div>
		</main>
	);
};
