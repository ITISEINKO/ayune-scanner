"use client";

import type { ReactNode } from "react";
import { BadgeCheck, LogOut, Mail, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
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
		<main className="mx-auto min-h-screen max-w-lg bg-muted/30 pb-28">
			<header className="flex items-center gap-3 rounded-b-3xl bg-primary px-4 py-5 text-primary-foreground">
				<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-card text-primary">
					<UserRound aria-hidden="true" className="size-7" />
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="text-sm font-bold tracking-wide">PROFIL</h1>
					{isPending ? (
						<Skeleton
							role="status"
							aria-label="Memuat nama profil"
							className="mt-1 h-4 w-28 max-w-full bg-primary-foreground/15"
						/>
					) : (
						<p className="mt-1 truncate text-xs capitalize text-primary-foreground/75" title={profile?.displayName ?? undefined}>
							{profile?.displayName ?? "Akun"}
						</p>
					)}
				</div>
				<Badge className="bg-primary-foreground/15 text-primary-foreground">
					{role.replaceAll("_", " ")}
				</Badge>
			</header>

			{children}

			<section
				className="mx-4 mt-4 space-y-3"
				aria-label="Account details"
				aria-busy={isPending}
			>
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
					<div className="  px-4">
						<div className="flex items-center gap-3 py-3">
							<Mail
								aria-hidden="true"
								className="size-4 shrink-0 text-primary"
							/>
							<div className="min-w-0">
								<p className="text-xs text-muted-foreground">Email</p>
								<p className="truncate text-sm font-semibold">
									{profile?.email ?? "Email unavailable"}
								</p>
							</div>
						</div>
						{role === "MEMBER" && (
							<div className="flex items-start gap-3 py-3">
								<BadgeCheck
									aria-hidden="true"
									className="mt-0.5 size-4 shrink-0 text-primary"
								/>
								<div className="min-w-0">
									<p className="text-xs text-muted-foreground">
										Allowed status
									</p>
									{allowedStatuses.length ? (
										<div className="mt-1.5 flex flex-wrap gap-1.5">
											{allowedStatuses.map((status) => (
												<Badge
													key={status}
													variant="secondary"
													className="h-6 bg-accent/30 px-2 text-xs text-foreground"
												>
													{status.replaceAll("_", " ")}
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
					className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 text-sm font-bold text-destructive transition-colors hover:bg-destructive/20"
				>
					<LogOut aria-hidden="true" className="size-4" />
					Logout
				</a>
			</section>
		</main>
	);
}
