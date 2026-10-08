import { LoginForm } from "./LoginForm";

export default function LoginPage({ error }: { error?: string }) {
	return (
		<main className="mx-auto h-dvh max-w-lg overflow-hidden bg-background text-primary-foreground">
			<section className="relative flex h-[48%] min-h-0 flex-col justify-end overflow-visible bg-primary px-6 pt-10 pb-5">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -top-32 -left-28 size-80 rounded-full bg-primary-foreground/10 blur-3xl"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -right-40 -bottom-40 size-96 rounded-full bg-secondary/30 blur-3xl"
				/>
				<div className="relative z-10 mx-auto flex w-full max-w-sm flex-col">
					<div className="flex items-center gap-2 text-[11px] font-black tracking-[0.3em] uppercase">
						<img
							src="/icon.svg"
							alt=""
							className="size-7 brightness-0 invert"
						/>
						AYUNE SCAN
					</div>
					<div className="mt-7 pb-10">
						<div>
							<h1 className="text-4xl font-black tracking-tight">LOG IN!</h1>
							<p className="mt-1 text-sm text-primary-foreground/70">
								to proceed
							</p>
						</div>
					</div>
				</div>
			</section>
			<section className="relative z-10 -mt-8 h-[calc(52%+2rem)] min-h-0 rounded-t-4xl bg-background px-6 pt-8 pb-8 text-foreground">
				<img
					src="/greet.svg"
					alt=""
					className="absolute -top-32 right-4 z-20 h-32 w-auto object-contain brightness-0 invert"
				/>
				<div className="mx-auto w-full max-w-sm">
					<LoginForm error={error} />
				</div>
			</section>
		</main>
	);
}
