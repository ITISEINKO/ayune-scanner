import { LoginForm } from "./LoginForm";

export default function LoginPage({ error }: { error?: string }) {
	return (
		<div className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-linear-to-br from-emerald-50 via-background to-amber-50 p-6 md:p-10">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -left-32 -top-32 size-80 rounded-full bg-primary/10 blur-3xl"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -bottom-40 -right-32 size-96 rounded-full bg-amber-200/20 blur-3xl"
			/>
			<div className="relative z-10 flex w-full max-w-sm flex-col gap-5">
				<div className="flex items-center justify-center gap-2 text-[11px] font-black tracking-[0.3em] text-primary uppercase">
					<img src="/icon.svg" alt="" className="size-5" />
					PPIC PANEL
				</div>
				<a
					href="#"
					className="relative -z-2 flex flex-col items-center self-center"
				>
					<img
						src="/greet-user.webp"
						alt="Welcome"
						className="h-44 w-auto object-contain drop-shadow-lg"
					/>
				</a>
				<LoginForm className="relative z-10 -mt-8" error={error} />
			</div>
		</div>
	);
}
