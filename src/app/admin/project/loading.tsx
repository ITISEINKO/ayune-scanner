import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingProject() {
	return (
		<main
			aria-busy="true"
			aria-label="Memuat detail project"
			className="mx-auto min-h-dvh max-w-lg bg-muted **:data-[slot=skeleton]:opacity-60"
		>
			<header className="bg-primary px-5 pt-3 pb-16">
				<div className="flex items-center justify-between">
					<Skeleton className="size-10 rounded-full bg-primary-foreground/20" />
					<div className="flex items-center gap-2">
						<Skeleton className="h-7 w-20 rounded-full bg-primary-foreground/20" />
						<Skeleton className="size-8 rounded-full bg-primary-foreground/20" />
					</div>
				</div>
				<Skeleton className="mt-5 h-14 w-4/5 bg-primary-foreground/20" />
				<div className="mt-5 flex items-end gap-2">
					<Skeleton className="h-16 w-20 bg-primary-foreground/20" />
					<Skeleton className="mb-1 h-6 w-12 bg-primary-foreground/20" />
				</div>
			</header>

			<div className="relative -mt-8 space-y-3 rounded-t-4xl bg-background p-4 pt-6 pb-28">
				<section className="grid grid-cols-2 divide-x overflow-hidden rounded-[1.35rem] border border-border/40 bg-card shadow-sm">
					{Array.from({ length: 2 }).map((_, index) => (
						<div key={index} className="p-4">
							<Skeleton className="size-4" />
							<Skeleton className="mt-3 h-3 w-16" />
							<Skeleton className="mt-2 h-5 w-28" />
						</div>
					))}
				</section>

				<section>
					<Skeleton className="h-3 w-24" />
					<Skeleton className="mx-auto mt-4 h-40 w-72 rounded-t-full" />
					<div className="mt-3 grid grid-cols-2 gap-2">
						{Array.from({ length: 5 }).map((_, index) => (
							<div
								key={index}
								className={`rounded-md bg-muted/30 px-3 py-2 ${index === 4 ? "col-span-2" : ""}`}
							>
								<div className="flex items-center gap-2">
									<Skeleton className="size-3 rounded-full" />
									<Skeleton className="h-4 w-6" />
								</div>
								<Skeleton className="mt-2 h-2 w-20" />
							</div>
						))}
					</div>
					<div className="mt-4 space-y-2">
						{Array.from({ length: 3 }).map((_, index) => (
							<div
								key={index}
								className="space-y-3 rounded-[18px] bg-card p-3 shadow-sm"
							>
								<div className="flex justify-between gap-4">
									<Skeleton className="h-4 w-2/3" />
									<Skeleton className="h-4 w-10" />
								</div>
								<Skeleton className="h-2 w-full rounded-full" />
								<div className="flex justify-between">
									{Array.from({ length: 5 }).map((_, statusIndex) => (
										<Skeleton key={statusIndex} className="h-3 w-8" />
									))}
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-xl border bg-card p-4 shadow-sm">
					<Skeleton className="h-4 w-36" />
					<div className="mt-4 space-y-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-4/5" />
					</div>
				</section>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="px-4 py-3">
						<Skeleton className="h-4 w-28" />
					</div>
					<div className="space-y-4 border-t px-4 py-3">
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={index}>
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="mt-2 h-3 w-full" />
							</div>
						))}
					</div>
				</section>
			</div>
		</main>
	);
}
