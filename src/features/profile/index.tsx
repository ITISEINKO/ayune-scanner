"use client";

import { hasPpicAdminAccess } from "@/types/ppic";
import { PageHeader } from "@/components/pageHeader";

import type { CSSProperties, ReactNode } from "react";
import {
	ArrowUpRight,
	BadgeCheck,
	LogOut,
	Mail,
	ShieldCheck,
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
import type { getProfile } from "@/features/profile/getProfile";

export function ProfileLayout({
	role,
	roleLabel,
	children,
	initialProfile,
}: {
	role: PpicRole;
	roleLabel?: string;
	children?: ReactNode;
	initialProfile: Awaited<ReturnType<typeof getProfile>>;
}) {
	const { data: profile, isPending, isError, refetch } = useProfile(initialProfile);
	const allowedStatuses = profile?.allowedStatuses ?? [];

	return (
		<main className="mx-auto min-h-dvh max-w-[480px] bg-background pb-28">
			<PageHeader eyebrow="Akun" title="Profil" />
			<div className="mx-4 mt-5 flex items-center gap-3">
				<div className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-muted text-lg font-bold">
					{profile?.displayName
						?.trim()
						.split(/\s+/)
						.slice(0, 2)
						.map((part) => part[0])
						.join("")
						.toUpperCase() || "?"}
				</div>
				<div className="min-w-0">
					{isPending ? (
						<Skeleton
							role="status"
							aria-label="Memuat nama profil"
							className="h-6 w-40"
						/>
					) : (
						<p className="text-[17px] font-bold wrap-break-word">
							{profile?.displayName ?? "Akun"}
						</p>
					)}
					<Badge className="mt-1 h-auto rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
						{roleLabel ?? role.replaceAll("_", " ")}
					</Badge>
				</div>
			</div>

			{!hasPpicAdminAccess(role) && children}

			<section
				className="mx-4 mt-6 space-y-3"
				aria-label="Account details"
				aria-busy={isPending}
			>
				<h2 className="px-1 text-xs font-semibold text-muted-foreground">
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
														variant="outline"
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
			{hasPpicAdminAccess(role) && children}
		</main>
	);
}
