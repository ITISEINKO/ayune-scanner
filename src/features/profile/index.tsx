"use client";

import { hasPpicAdminAccess } from "@/types/ppic";

import type { CSSProperties, ReactNode } from "react";
import {
	ArrowUpRight,
	BadgeCheck,
	LogOut,
	Mail,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import {
	STATUS_BADGE_CLASS_NAME,
	STATUS_COLOR_CONFIG,
} from "@/lib/colorStatusConfig";
import type { PpicRole } from "@/types/ppic";

export function ProfileLayout({
	role,
	children,
}: {
	role: PpicRole;
	children?: ReactNode;
}) {
	const { data: profile, isPending, isError, refetch } = useProfile();
	const allowedStatuses = profile?.allowedStatuses ?? [];

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-28">
			<header className="relative isolate overflow-hidden rounded-b-4xl bg-primary px-5 pt-7 pb-6 text-primary-foreground">
				<img
					src="/ayune-14.svg"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -top-14 -right-20 -z-10 size-64 opacity-10"
				/>
				<h1 className="text-xs font-bold tracking-[0.18em] uppercase text-primary-foreground/70">
					Profil
				</h1>
				<div className="mt-5 flex items-start gap-4">
					<div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10">
						<UserRound aria-hidden="true" className="size-8" />
					</div>
					<div className="min-w-0 flex-1">
						{isPending ? (
							<Skeleton
								role="status"
								aria-label="Memuat nama profil"
								className="mt-1 h-7 w-40 max-w-full bg-primary-foreground/15"
							/>
						) : (
							<p
								className="text-2xl leading-tight font-bold wrap-break-word capitalize tracking-tight"
								title={profile?.displayName ?? undefined}
							>
								{profile?.displayName ?? "Akun"}
							</p>
						)}
						<Badge className="mt-3 h-auto rounded-full border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-primary-foreground">
							<ShieldCheck aria-hidden="true" />
							{role.replaceAll("_", " ")}
						</Badge>
					</div>
				</div>
			</header>

			{children}

			<section
				className="mx-4 mt-6 space-y-3"
				aria-label="Account details"
				aria-busy={isPending}
			>
				<h2 className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
					Detail akun
				</h2>
				{isPending ? (
					<div
						role="status"
						aria-label="Memuat detail akun"
						className="space-y-3 rounded-2xl border bg-card p-4"
					>
						<Skeleton className="h-3 w-12" />
						<Skeleton className="h-4 w-48 max-w-full" />
						{role === "MEMBER" && <Skeleton className="h-6 w-full" />}
					</div>
				) : isError ? (
					<div role="alert" className="rounded-2xl border bg-card p-4 text-sm">
						<p>Gagal memuat detail akun.</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-2"
							onClick={() => void refetch()}
						>
							Coba lagi
						</Button>
					</div>
				) : (
					<div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
						<div className="flex items-center gap-3 p-4">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/70">
								<Mail aria-hidden="true" className="size-4 text-primary" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-xs text-muted-foreground">Email</p>
								<p className="mt-1 text-sm font-semibold wrap-break-word">
									{profile?.email ?? "Email unavailable"}
								</p>
							</div>
						</div>
						{hasPpicAdminAccess(role) && (
							<div className="flex items-start gap-3 p-4">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/20">
									<ShieldCheck
										aria-hidden="true"
										className="size-4 text-primary"
									/>
								</div>
								<div className="min-w-0">
									<h3 className="text-sm font-semibold">Akses administrator</h3>
									<p className="mt-1 text-sm leading-6 text-muted-foreground">
										Pantau dashboard, kelola project, ubah status barang, dan
										atur akses tim.
									</p>
								</div>
							</div>
						)}
						{role === "MEMBER" && (
							<div className="flex items-start gap-3 p-4">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/70">
									<BadgeCheck
										aria-hidden="true"
										className="size-4 text-primary"
									/>
								</div>
								<div className="min-w-0">
									<p className="text-xs text-muted-foreground">Akses scan</p>
									{allowedStatuses.length ? (
										<div className="mt-1.5 flex flex-wrap gap-1.5">
											{allowedStatuses.map((status) => (
												<Badge
													key={status}
													variant="secondary"
													className={`${STATUS_BADGE_CLASS_NAME} h-auto px-2 py-1 text-xs`}
													style={
														{
															"--status-color":
																STATUS_COLOR_CONFIG[status].color,
															"--status-text-color":
																STATUS_COLOR_CONFIG[status].textColor,
														} as CSSProperties
													}
												>
													{STATUS_COLOR_CONFIG[status].shortLabel}
												</Badge>
											))}
										</div>
									) : (
										<p className="text-sm font-semibold">No scan access</p>
									)}
								</div>
							</div>
						)}
					</div>
				)}
				<a
					href="/api/auth/logout"
					className="group flex min-h-16 items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
						<LogOut aria-hidden="true" className="size-4" />
					</span>
					<span className="flex-1">
						<span className="block text-sm font-bold">Logout</span>
						<span className="mt-0.5 block text-xs text-muted-foreground">
							Keluar dari akun ini
						</span>
					</span>
					<ArrowUpRight
						aria-hidden="true"
						className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
					/>
				</a>
			</section>
		</main>
	);
}
