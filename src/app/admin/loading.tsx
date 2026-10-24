import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingAdmin() {
	return (
		<main
			aria-busy="true" aria-label="Memuat dashboard admin"
			className="mx-auto min-h-dvh max-w-lg space-y-4 p-4 pb-28 **:data-[slot=skeleton]:opacity-60"
		>
			<Skeleton className="h-48 rounded-b-[2.5rem]" />
			<Skeleton className="h-40 rounded-3xl" />
			<div className="grid grid-cols-3 gap-3">
				{[0, 1, 2].map((key) => <Skeleton key={key} className="h-36 rounded-3xl" />)}
			</div>
			<Skeleton className="h-28 rounded-3xl" />
			<Skeleton className="h-80 rounded-3xl" />
		</main>
	);
}
