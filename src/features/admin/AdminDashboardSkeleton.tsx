import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import { PPIC_STATUSES } from "@/types/ppic";

export function AdminDashboardSkeleton() {
	return (
		<main
			aria-busy="true"
			aria-label="Memuat dashboard admin"
			className="mx-auto min-h-dvh max-w-lg bg-background pb-28"
		>
			<header className="rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-5">
				<div className="relative mt-4">
					<Skeleton className="absolute top-0 right-0 size-9 rounded-lg" />
					<Skeleton className="h-4 w-40" />
					<h1 className="mt-1 text-[27px] font-extrabold tracking-tight">
						Dashboard produksi
					</h1>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						Kondisi semua project dan tim, langsung dari hasil scan.
					</p>
					<Skeleton className="mt-3 h-4 w-52 max-w-full" />
				</div>
			</header>

			<div aria-hidden="true" className="space-y-4 px-4 pt-4">
				<div className="rounded-3xl bg-primary p-5">
					<Skeleton className="h-5 w-28 bg-primary-foreground/15" />
					<Skeleton className="mt-1 h-13.75 w-32 bg-primary-foreground/15" />
					<Skeleton className="mt-1 h-4 w-60 max-w-full bg-primary-foreground/15" />
					<Skeleton className="mt-4 h-2 w-full rounded-full bg-primary-foreground/15" />
				</div>
				<div className="grid grid-cols-3 gap-2.5">
					{[0, 1, 2].map((key) => (
						<div key={key} className="min-w-0 rounded-xl bg-card p-3.5">
							<div className="h-10 space-y-1.5">
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-2/3" />
							</div>
							<Skeleton className="mt-2 h-8 w-12" />
							<Skeleton className="mt-1 h-8 w-full" />
						</div>
					))}
				</div>
				<div>
					<div className="mb-2 flex h-8 items-center justify-between px-1">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-8 w-28 rounded-lg" />
					</div>
					<div className="rounded-3xl bg-card p-4">
						<div className="flex h-44 items-end gap-2 pb-5">
							{[44, 72, 56, 96, 64, 112, 80].map((height, index) => (
								<Skeleton
									key={index}
									className="flex-1 rounded-md"
									style={{ height }}
								/>
							))}
						</div>
						<div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
							{PPIC_STATUSES.map((status) => (
								<div
									key={status}
									className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
								>
									<Skeleton className="size-2 rounded-sm" />
									{STATUS_COLOR_CONFIG[status].label}
								</div>
							))}
						</div>
						<Skeleton className="mt-3 h-4 w-60 max-w-full" />
					</div>
				</div>
				<div>
					<Skeleton className="mx-1 mb-2 h-4 w-32" />
					<div className="space-y-4 rounded-3xl bg-card p-4">
						<Skeleton className="h-4 w-4/5" />
						<Skeleton className="h-4 w-3/5" />
					</div>
				</div>
				<div>
					<Skeleton className="mx-1 mb-2 h-4 w-28" />
					<div className="divide-y divide-border/40 overflow-hidden rounded-3xl bg-card">
						{[0, 1, 2].map((key) => (
							<div key={key} className="flex items-center gap-3 px-4 py-3">
								<Skeleton className="size-11 shrink-0 rounded-full" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-3 w-20" />
								</div>
								<Skeleton className="h-9 w-10" />
							</div>
						))}
					</div>
				</div>
			</div>
		</main>
	);
}
