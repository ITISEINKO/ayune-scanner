"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleHelp, Menu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminDashboardSkeleton } from "@/features/admin/AdminDashboardSkeleton";
import type { AdminDashboardData, OverviewMember } from "@/lib/adminOverview";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import { PPIC_STATUSES } from "@/types/ppic";

const MemberScanOverview = dynamic(() =>
	import("@/features/settings/MemberScanOverview").then(
		(module) => module.MemberScanOverview,
	),
);

async function loadDashboard(
	refresh = false,
	signal?: AbortSignal,
): Promise<AdminDashboardData> {
	const response = await fetch(
		`/api/admin/dashboard${refresh ? "?refresh=1" : ""}`,
		{ cache: "no-store", signal },
	);
	if (!response.ok) throw new Error("DASHBOARD_UNAVAILABLE");
	return response.json();
}

export function AdminDashboard({
	userId,
	initialData,
}: {
	userId: string;
	initialData?: AdminDashboardData;
}) {
	const { data, isError, isFetching, refetch } = useQuery({
		queryKey: ["admin-dashboard", userId],
		queryFn: ({ signal }) => loadDashboard(true, signal),
		initialData,
		staleTime: Infinity,
		refetchOnReconnect: false,
	});
	if (!data && !isError) return <AdminDashboardSkeleton />;
	if (!data)
		return (
			<main
				className="mx-auto min-h-dvh max-w-lg space-y-4 p-4 pb-28"
				aria-busy={isFetching}
			>
				<h1 className="mt-6 text-[27px] font-extrabold">Dashboard produksi</h1>
				<div role="alert" className="rounded-2xl border p-4 text-sm">
					<p>Dashboard belum dapat dimuat.</p>
					<Button
						className="mt-3"
						variant="outline"
						disabled={isFetching}
						onClick={() => void refetch()}
					>
						Coba lagi
					</Button>
				</div>
			</main>
		);
	return (
		<AdminDashboardContent
			{...data}
			refreshing={isFetching}
			refresh={() => void refetch()}
			refreshError={isError}
		/>
	);
}

function AdminDashboardContent({
	now,
	totals,
	projectsReady,
	projectCount,
	members,
	dailyScans,
	refreshing,
	refresh,
	refreshError,
}: AdminDashboardData & {
	refreshing: boolean;
	refresh: () => void;
	refreshError: boolean;
}) {
	const [scanDays, setScanDays] = useState<7 | 30>(7);
	const chartDays = dailyScans?.slice(-scanDays) ?? [];
	const peak = Math.max(1, ...chartDays.map((day) => day.count));
	const chartStatuses = [...PPIC_STATUSES, "OTHER" as const].filter(
		(status) =>
			status !== "OTHER" || chartDays.some((day) => day.statuses.OTHER > 0),
	);
	const chartDateFormat = new Intl.DateTimeFormat(
		"id-ID",
		scanDays === 7
			? { timeZone: "Asia/Jakarta", weekday: "short" }
			: { timeZone: "Asia/Jakarta", day: "numeric", month: "short" },
	);
	const [selectedMember, setSelectedMember] = useState<OverviewMember | null>(
		null,
	);
	const teamReady =
		members !== null && members.every((member) => member.summary !== null);
	const team = (members ?? [])
		.filter((member) => (member.summary?.today ?? 0) > 0)
		.sort(
			(a, b) =>
				(b.summary?.today ?? 0) - (a.summary?.today ?? 0) ||
				(b.summary?.total ?? 0) - (a.summary?.total ?? 0) ||
				a.name.localeCompare(b.name),
		);
	const attention = [
		...(projectsReady && totals.returns
			? [
					{
						label: `${totals.returns} barang dalam proses retur`,
						href: "/admin/projects",
					},
				]
			: []),
		...(teamReady && totals.idle
			? [
					{
						label: `${totals.idle} petugas belum scan hari ini`,
						href: "/admin/settings",
					},
				]
			: []),
		...(members && totals.noAccess
			? [
					{
						label: `${totals.noAccess} anggota belum punya akses scan`,
						href: "/admin/settings",
					},
				]
			: []),
	];
	const date = new Intl.DateTimeFormat("id-ID", {
		timeZone: "Asia/Jakarta",
		dateStyle: "full",
	}).format(now);

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-28">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-5">
				<img
					src="/ayune-14.svg"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -top-20 -right-16 size-70 opacity-10"
				/>

				<div className="relative mt-4">
					<Button
						aria-label="Perbarui dashboard"
						variant="outline"
						size="icon"
						className="absolute top-0 right-0"
						onClick={refresh}
						disabled={refreshing}
					>
						<RefreshCw
							aria-hidden="true"
							className={refreshing ? "animate-spin" : ""}
						/>
					</Button>
					<p className="text-xs font-bold text-muted-foreground">{date}</p>
					<h1 className="mt-1 text-[27px] font-extrabold tracking-tight">
						Dashboard produksi
					</h1>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						Kondisi semua project dan tim, langsung dari hasil scan.
					</p>
					<p
						className="mt-3 text-[11px] leading-4 text-muted-foreground"
						role="status"
					>
						{refreshing ? (
							"Memperbarui dashboard…"
						) : (
							<>
								Data terakhir:{" "}
								<time dateTime={new Date(now).toISOString()}>
									{new Intl.DateTimeFormat("id-ID", {
										timeZone: "Asia/Jakarta",
										dateStyle: "medium",
										timeStyle: "short",
									}).format(now)}{" "}
									WIB
								</time>
							</>
						)}
					</p>
				</div>
			</header>

			<div className="space-y-4 px-4 pt-4" aria-busy={refreshing}>
				{(!projectsReady ||
					!teamReady ||
					dailyScans === null ||
					refreshError) && (
					<div
						role="alert"
						className="rounded-2xl border border-border p-4 text-sm"
					>
						<p>
							{refreshError
								? "Gagal memperbarui dashboard. Data sebelumnya tetap ditampilkan. "
								: ""}
							{!projectsReady
								? "Ringkasan barang belum tersedia lengkap. "
								: ""}
							{!teamReady ? "Sebagian data tim belum dapat dimuat." : ""}
							{dailyScans === null ? " Grafik scan belum dapat dimuat." : ""}
						</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-2"
							onClick={refresh}
							disabled={refreshing}
						>
							Coba lagi
						</Button>
					</div>
				)}
				<Link
					href="/admin/projects"
					className="block rounded-3xl bg-primary p-5 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<h2 className="text-sm font-bold text-primary-foreground/75">
						Barang tercatat
					</h2>
					<p className="mt-1 text-[44px] leading-tight font-extrabold tracking-tight">
						{projectsReady ? `${totals.percentage}%` : "—"}
					</p>
					<p className="mt-1 text-xs text-primary-foreground/80">
						{projectsReady
							? `${totals.recorded} dari ${totals.total} barang`
							: "Data barang belum lengkap"}{" "}
						· {projectCount ?? "—"} project berjalan
					</p>
					{projectsReady && (
						<span
							role="img"
							aria-label={totals.statuses
								.map(
									({ status, count }) =>
										`${STATUS_COLOR_CONFIG[status].label}: ${count}`,
								)
								.join(", ")}
							className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/15"
						>
							{[
								...totals.statuses.filter(
									({ status }) => status !== "UNSCANNED",
								),
								totals.statuses[0],
							]
								.filter(({ count }) => count > 0)
								.map(({ status, count }) => {
									const color = STATUS_COLOR_CONFIG[status];
									return (
										<span
											key={status}
											aria-hidden="true"
											style={{
												flex: count,
												backgroundColor:
													"progressColor" in color
														? color.progressColor
														: color.color,
											}}
										/>
									);
								})}
						</span>
					)}
				</Link>

				<section
					aria-label="Aktivitas scan tim"
					className="grid grid-cols-3 gap-2.5"
				>
					<article className="flex min-w-0 flex-col rounded-xl bg-card p-3.5">
						<h2 className="min-h-10 text-xs font-bold leading-4 text-muted-foreground">
							Scan hari ini
						</h2>
						<p className="mt-2 text-[27px] leading-tight font-extrabold">
							{teamReady ? totals.today : "—"}
						</p>
						<p
							className={`mt-1 text-[11px] leading-4 ${totals.change > 0 ? "font-bold text-green-700" : "text-muted-foreground"}`}
						>
							{teamReady
								? `${totals.change > 0 ? "+" : ""}${totals.change} dibanding kemarin`
								: "Data belum lengkap"}
						</p>
					</article>
					<article className="flex min-w-0 flex-col rounded-xl bg-card p-3.5">
						<h2 className="min-h-10 text-xs font-bold leading-4 text-muted-foreground">
							Petugas aktif hari ini
						</h2>
						<p className="mt-2 text-[27px] leading-tight font-extrabold">
							{teamReady ? (
								<>
									{totals.active}
									<span className="text-lg text-muted-foreground">
										/{totals.enabled}
									</span>
								</>
							) : (
								"—"
							)}
						</p>
						<p className="mt-1 text-[11px] leading-4 text-muted-foreground">
							{teamReady
								? `${totals.idle} orang belum scan`
								: "Data belum lengkap"}
						</p>
					</article>
					<article className="flex min-w-0 flex-col rounded-xl bg-card p-3.5">
						<h2 className="min-h-10 text-xs font-bold leading-4 text-muted-foreground">
							Scan 7 hari
						</h2>
						<p className="mt-2 text-[27px] leading-tight font-extrabold">
							{teamReady ? totals.week : "—"}
						</p>
						<p className="mt-1 text-[11px] leading-4 text-muted-foreground">
							{teamReady
								? `rata-rata ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(totals.week / 7)} per hari`
								: "Data belum lengkap"}
						</p>
					</article>
				</section>

				<section aria-labelledby="daily-scans-heading">
					<div className="mb-2 flex items-center justify-between gap-2 px-1">
						<h2
							id="daily-scans-heading"
							className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
						>
							Scan per hari
						</h2>
						<div
							className="flex rounded-lg bg-muted p-0.5"
							role="group"
							aria-label="Periode scan tim"
						>
							{([7, 30] as const).map((days) => (
								<Button
									key={days}
									size="sm"
									variant={scanDays === days ? "secondary" : "ghost"}
									className="h-7 px-2 text-xs"
									aria-pressed={scanDays === days}
									onClick={() => setScanDays(days)}
								>
									{days} hari
								</Button>
							))}
						</div>
					</div>
					<div className="rounded-3xl bg-card p-4">
						{dailyScans === null ? (
							<p className="text-sm text-muted-foreground">
								Grafik scan belum tersedia.
							</p>
						) : (
							<>
								<div
									className="overflow-x-auto"
									role="region"
									tabIndex={0}
									aria-label={`Grafik scan tim ${scanDays} hari, geser untuk melihat semua hari`}
								>
									<ol
										className="flex h-44 items-end gap-2"
										style={{ minWidth: scanDays === 30 ? 30 * 38 : undefined }}
									>
										{chartDays.map((day, index) => {
											const label =
												index === chartDays.length - 1
													? "Hari ini"
													: chartDateFormat.format(
															new Date(`${day.date}T00:00:00+07:00`),
														);
											return (
												<li
													key={day.date}
													className="flex min-w-0 flex-1 flex-col items-center"
													aria-label={`${day.date}: ${day.count} scan; ${chartStatuses.map((status) => `${STATUS_COLOR_CONFIG[status].label}: ${day.statuses[status]}`).join(", ")}`}
												>
													<span
														aria-hidden="true"
														className="mb-1 text-[11px] tabular-nums"
													>
														{day.count}
													</span>
													<div
														aria-hidden="true"
														className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-md"
														style={{ height: `${(day.count / peak) * 128}px` }}
													>
														{chartStatuses
															.filter((status) => day.statuses[status] > 0)
															.map((status) => (
																<span
																	key={status}
																	className="w-full border-t border-card first:border-0"
																	style={{
																		flex: day.statuses[status],
																		backgroundColor:
																			STATUS_COLOR_CONFIG[status].color,
																	}}
																/>
															))}
													</div>
													<span
														aria-hidden="true"
														className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground"
													>
														{label}
													</span>
												</li>
											);
										})}
									</ol>
								</div>
								<ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-[11px]">
									{chartStatuses.map((status) => (
										<li key={status} className="flex items-center gap-1.5">
											<span
												aria-hidden="true"
												className="size-2 shrink-0 rounded-sm"
												style={{
													backgroundColor: STATUS_COLOR_CONFIG[status].color,
												}}
											/>
											{STATUS_COLOR_CONFIG[status].label}
										</li>
									))}
								</ul>
								{!chartDays.some((day) => day.count > 0) && (
									<p className="mt-3 text-xs text-muted-foreground">
										Belum ada scan pada periode ini.
									</p>
								)}
							</>
						)}
						<p className="mt-3 text-[11px] text-muted-foreground">
							WIB · termasuk scan berulang · hari ini belum selesai
						</p>
					</div>
				</section>
				{/* do not delete this as this is still in dev mode , u need to inform or confirm with me before delete this  */}
				{/* <section aria-labelledby="attention-heading">
					<div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-muted-foreground">
						<h2 id="attention-heading" className="tracking-wide uppercase">
							Perlu perhatian
						</h2>
						<span>{attention.length} hal</span>
					</div>
					<div className="divide-y divide-border/40 overflow-hidden rounded-3xl bg-card">
						{attention.map((item) => (
							<Link
								key={item.label}
								href={item.href}
								className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm hover:bg-muted/50 focus-visible:bg-muted"
							>
								<span>{item.label}</span>
								<ArrowRight
									aria-hidden="true"
									className="size-4 shrink-0 text-muted-foreground"
								/>
							</Link>
						))}
						{!attention.length && (
							<p className="px-4 py-3.5 text-sm text-muted-foreground">
								{projectsReady && teamReady
									? "Tidak ada hal yang perlu perhatian saat ini."
									: "Menunggu ringkasan lengkap."}
							</p>
						)}
					</div>
				</section> */}

				<section
					id="team-today"
					aria-labelledby="team-heading"
					className="scroll-mt-4"
				>
					<div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-muted-foreground">
						<h2 id="team-heading" className="tracking-wide uppercase">
							Tim hari ini
						</h2>
						<span>ketuk untuk detail</span>
					</div>
					<div className="divide-y divide-border/40 overflow-hidden rounded-3xl bg-card">
						{team.map((member) => (
							<button
								key={member.id}
								type="button"
								onClick={() => setSelectedMember(member)}
								className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
							>
								<span
									aria-hidden="true"
									className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/25 text-sm font-extrabold"
								>
									{member.name
										.trim()
										.split(/\s+/)
										.slice(0, 2)
										.map((part) => Array.from(part)[0])
										.join("")
										.toUpperCase()}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-extrabold">
										{member.name}
									</span>
									<span
										className={`mt-0.5 block text-xs ${member.hasAccess ? "text-muted-foreground" : "font-bold text-amber-700"}`}
									>
										{!member.hasAccess
											? "Belum punya akses"
											: `${member.summary?.total} scan 7 hari`}
									</span>
								</span>

								<span className="w-12 shrink-0 text-right">
									<span className="block text-2xl leading-6 font-extrabold">
										{member.summary?.today}
									</span>
									<span className="block text-[11px] text-muted-foreground">
										hari ini
									</span>
								</span>
							</button>
						))}
						{!team.length && (
							<p className="p-4 text-sm text-muted-foreground">
								{teamReady
									? "Belum ada anggota yang scan hari ini."
									: "Aktivitas tim belum dapat dimuat lengkap."}
							</p>
						)}
					</div>
					<p className="mt-3 px-1 text-[11px] text-muted-foreground">
						7 hari kalender · WIB · termasuk scan berulang
					</p>
				</section>
			</div>

			<Drawer
				open={!!selectedMember}
				onOpenChange={(open) => {
					if (!open) setSelectedMember(null);
				}}
			>
				<DrawerContent className="[--drawer-inset:0px]! mx-auto max-w-lg rounded-t-3xl bg-background">
					<DrawerHeader className="text-left">
						<DrawerTitle>{selectedMember?.name}</DrawerTitle>
						<DrawerDescription>Aktivitas scan anggota tim</DrawerDescription>
					</DrawerHeader>
					<div className="overflow-y-auto">
						{selectedMember && (
							<MemberScanOverview
								key={selectedMember.id}
								memberId={selectedMember.id}
							/>
						)}
					</div>
					<DrawerFooter>
						<DrawerClose render={<Button variant="outline" />}>
							Tutup
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</main>
	);
}
