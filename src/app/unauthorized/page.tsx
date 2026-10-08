import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
	return (
		<main className="flex min-h-svh items-center justify-center bg-muted p-6">
			<section className="w-full max-w-sm rounded-2xl border border-border/50 bg-background p-6 text-center shadow-sm">
				<img src="/401.webp" alt="" className="mx-auto mb-4 w-full max-w-xs" />
				<h1 className="text-xl font-bold">Access denied</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					You don&apos;t have access to this. Ask your admin.
				</p>
			</section>
		</main>
	);
}
