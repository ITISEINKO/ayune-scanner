import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingProject() {
	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 p-4 pb-28">
			<div className="h-12 rounded-xl bg-card" />
			<div className="mt-4 space-y-3">
				<Skeleton className="h-48 rounded-xl" />
				<Skeleton className="h-40 rounded-xl" />
				<Skeleton className="h-64 rounded-xl" />
			</div>
		</main>
	);
}
