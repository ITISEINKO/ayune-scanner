"use client";

import { BadgeCheck, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";

export const ProfilePage = () => {
	const { data: profile } = useProfile();
	const role = profile?.role?.replaceAll("_", " ") ?? "Not available";
	const allowedStatus =
		profile?.allowedStatus?.replaceAll("_", " ") ?? "No scan access";

	return (
		<main className="mx-auto min-h-screen max-w-lg bg-muted/30   pb-28">
			<section className="overflow-hidden rounded-b-4xl bg-accent/30">
				<header className="relative h-44 overflow-hidden rounded-b-4xl bg-primary px-6 pt-8 text-primary-foreground">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -top-32 -left-28 size-80 rounded-full bg-primary-foreground/10 blur-3xl"
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -right-40 -bottom-40 size-96 rounded-full bg-secondary/30 blur-3xl"
					/>
					<div className="relative z-10">
						<p className="text-sm font-semibold tracking-wide">PROFILE</p>
						<p className="mt-2 text-sm text-primary-foreground/75">
							Your PPIC account
						</p>
					</div>
				</header>
				<div className="relative -mt-12 px-6 pb-7 text-center">
					<div className="mx-auto flex size-24 items-center justify-center rounded-full border-4 border-card bg-white text-accent-foreground shadow-sm">
						<UserRound aria-hidden="true" className="size-11" />
					</div>
					<p className="mt-3 text-lg font-bold">{role}</p>
					<p className="text-sm text-muted-foreground">PPIC account</p>
				</div>
			</section>

			<section className="mt-6 mx-6 space-y-3" aria-label="Account details">
				<div className="flex items-center gap-3 rounded-xl   p-4 ">
					<Mail aria-hidden="true" className="size-5 text-primary" />
					<div className="min-w-0">
						<p className="text-xs text-muted-foreground">Email</p>
						<p className="truncate text-sm font-semibold">
							{profile?.email ?? "Email unavailable"}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3 rounded-xl   p-4 ">
					<ShieldCheck aria-hidden="true" className="size-5 text-primary" />
					<div>
						<p className="text-xs text-muted-foreground">Role</p>
						<p className="text-sm font-semibold">{role}</p>
					</div>
				</div>
				<div className="flex items-center gap-3 rounded-xl   p-4 ">
					<BadgeCheck aria-hidden="true" className="size-5 text-primary" />
					<div>
						<p className="text-xs text-muted-foreground">Allowed status</p>
						<p className="text-sm font-semibold">{allowedStatus}</p>
					</div>
				</div>
				<a
					href="/api/auth/logout"
					className="flex min-h-12 items-center justify-center gap-2 mt-3 rounded-xl bg-destructive/10 px-4 text-sm font-bold text-destructive transition-colors hover:bg-destructive/20"
				>
					<LogOut aria-hidden="true" className="size-4" />
					Logout
				</a>
			</section>
		</main>
	);
};
