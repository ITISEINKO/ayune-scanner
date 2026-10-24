"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pie, PieChart } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import type { MemberScanPeriod, MemberScanSummary } from "@/types/ppic";

const dateLabel = (date: string, days: number) =>
	new Intl.DateTimeFormat(
		"id-ID",
		days === 7
			? { weekday: "short", timeZone: "Asia/Jakarta" }
			: { day: "numeric", month: "short", timeZone: "Asia/Jakarta" },
	).format(new Date(`${date}T00:00:00+07:00`));

export function MemberScanOverview({ memberId }: { memberId?: string }) {
	const [period, setPeriod] = useState<MemberScanPeriod>("7");
	const { data, isPending, isError, refetch } = useQuery({
		queryKey: memberId
			? ["member-scan-summary", memberId, period]
			: ["profile", "scan-summary"],
		staleTime: 0,
		queryFn: async ({ signal }): Promise<MemberScanSummary> => {
			const url = memberId
				? `/api/panel/members/summary?${new URLSearchParams({ user_id: memberId, period })}`
				: "/api/profile/scan-summary";
			const response = await fetch(url, {
				cache: "no-store",
				signal,
			});
			if (!response.ok) throw new Error("summary");
			return response.json();
		},
	});
	const peak = data?.days.reduce((best, day) =>
		day.count > best.count ? day : best,
	);
	const statusData =
		(data && (memberId ? data.statuses : data.lifetimeStatuses))
			?.filter(({ count }) => count > 0)
			.map((bucket) => ({
				...bucket,
				fill: STATUS_COLOR_CONFIG[bucket.status].color,
			})) ?? [];
	const statusTotal = (memberId ? data?.total : data?.lifetimeTotal) ?? 0;
	const change = data?.previousTotal
		? Math.round(((data.total - data.previousTotal) / data.previousTotal) * 100)
		: null;

	return (
		<div
			className={
				memberId ? "space-y-4 px-6 pt-4 pb-6" : "space-y-3 px-4 pt-2 pb-2"
			}
			aria-busy={isPending}
		>
			{memberId && (
				<div className="flex gap-2" aria-label="Periode ringkasan">
					{(
						[
							["7", "7 hari"],
							["30", "30 hari"],
							["month", "Bulan ini"],
						] as const
					).map(([value, label]) => (
						<Button
							key={value}
							size="sm"
							variant={period === value ? "default" : "outline"}
							className="rounded-full"
							aria-pressed={period === value}
							onClick={() => setPeriod(value)}
						>
							{label}
						</Button>
					))}
				</div>
			)}
			{isPending ? (
				<div
					role="status"
					aria-label="Memuat ringkasan scan"
					className="space-y-3"
				>
					<Skeleton className="h-4 w-48 max-w-full" />
					<div className="grid grid-cols-2 gap-3">
						<Skeleton className="h-24 rounded-2xl" />
						<Skeleton className="h-24 rounded-2xl" />
					</div>
					<Skeleton className="h-56 rounded-2xl" />
					<Skeleton className="h-36 rounded-2xl" />
				</div>
			) : isError ? (
				<div role="alert" className="rounded-2xl border p-4 text-sm">
					<p>Gagal memuat ringkasan scan.</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-3"
						onClick={() => void refetch()}
					>
						Coba lagi
					</Button>
				</div>
			) : (
				data && (
					<>
						<p className="text-xs text-muted-foreground">
							{data.lastScannedAt
								? `Scan terakhir ${new Intl.DateTimeFormat("id-ID", {
										dateStyle: "medium",
										timeStyle: "short",
										timeZone: "Asia/Jakarta",
									}).format(new Date(data.lastScannedAt))} WIB`
								: "Belum ada riwayat scan."}
						</p>
						<div className="grid grid-cols-2 gap-3">
							<section className="rounded-2xl border border-border/30 bg-card p-4">
								<h3 className="text-xs text-muted-foreground">Total scan</h3>
								<p className="mt-1 text-3xl font-bold tabular-nums">
									{(memberId ? data.total : data.lifetimeTotal).toLocaleString(
										"id-ID",
									)}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{!memberId
										? "Sepanjang waktu"
										: change === null
											? "Periode sebelumnya: 0"
											: `${change > 0 ? "+" : ""}${change}% vs ${data.days.length} hari sebelumnya`}
								</p>
							</section>
							<section className="rounded-2xl border border-border/30 bg-card p-4">
								<h3 className="text-xs text-muted-foreground">
									{memberId ? "Hari ini (sementara)" : "Total scan"}
								</h3>
								<p className="mt-1 text-3xl font-bold tabular-nums">
									{(memberId ? data.today : data.total).toLocaleString("id-ID")}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{!memberId ? (
										"7 hari terakhir"
									) : (
										<>
											Rata-rata{" "}
											{(data.total / data.days.length).toLocaleString("id-ID", {
												maximumFractionDigits: 1,
											})}
											/hari
										</>
									)}
								</p>
							</section>
						</div>
						{data.total === 0 && (
							<p className="text-sm text-muted-foreground">
								{memberId ? "Belum ada scan pada periode ini." : "Belum ada scan dalam 7 hari terakhir."}
							</p>
						)}
						<section className="rounded-2xl border border-border/30 bg-card p-4">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
								<h3 className="font-bold">
									{memberId ? "Scan per hari" : "7 hari terakhir"}
								</h3>
								{peak && peak.count > 0 && (
									<p className="text-xs text-muted-foreground">
										Puncak {dateLabel(peak.date, data.days.length)},{" "}
										{peak.count}
									</p>
								)}
							</div>
							<div
								className="overflow-x-auto pb-1"
								tabIndex={0}
								role="region"
								aria-label="Grafik scan harian, geser untuk melihat semua hari"
							>
								<div
									className="flex h-36 gap-2"
									style={{
										minWidth:
											data.days.length > 7 ? data.days.length * 36 : undefined,
									}}
								>
									{data.days.map((day, index) => (
										<div
											key={day.date}
											className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
											aria-label={`${dateLabel(day.date, data.days.length)}: ${day.count} scan`}
										>
											<span className="text-[10px] tabular-nums text-muted-foreground">
												{day.count}
											</span>
											<div
												className={`w-full max-w-9 rounded-t-md ${index === data.days.length - 1 ? "bg-accent" : "bg-muted"}`}
												style={{
													height: `${(day.count / Math.max(1, peak?.count ?? 0)) * 96}px`,
													minHeight: 2,
												}}
											/>
											<span className="whitespace-nowrap text-[10px] text-muted-foreground">
												{dateLabel(day.date, data.days.length)}
											</span>
										</div>
									))}
								</div>
							</div>
						</section>
						<section
							className="rounded-2xl border border-border/30 bg-card p-4"
							aria-label="Ringkasan scan per status"
						>
							<div className="mb-4">
								<h3 className="font-bold">
									{memberId ? "Scan per status" : "Total scan per status"}
								</h3>
								{!memberId && <p className="mt-1 text-xs text-muted-foreground">Sepanjang waktu</p>}
							</div>
							<div className="flex items-center gap-4">
								<div className="relative size-32 shrink-0">
									<ChartContainer
										config={STATUS_COLOR_CONFIG}
										className="size-32 aspect-square"
										initialDimension={{ width: 128, height: 128 }}
										aria-hidden="true"
									>
										<PieChart accessibilityLayer={false}>
											<Pie
												data={
													statusData.length
														? statusData
														: [{ count: 1, fill: "var(--muted)" }]
												}
												dataKey="count"
												nameKey="status"
												innerRadius={42}
												outerRadius={58}
												startAngle={90}
												endAngle={-270}
												className="stroke-card stroke-2"
												isAnimationActive={false}
											/>
										</PieChart>
									</ChartContainer>
									<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
										<p
											className="max-w-20 truncate text-xl font-bold tabular-nums"
											aria-label={`Total ${statusTotal.toLocaleString("id-ID")} scan ${memberId ? "pada periode ini" : "sepanjang waktu"}`}
										>
											{statusTotal.toLocaleString("id-ID")}
										</p>
										<p className="text-[10px] text-muted-foreground">
											total scan
										</p>
									</div>
								</div>
								<ul className="min-w-0 flex-1 space-y-3">
									{statusData.map(({ status, count, fill }) => (
										<li key={status} className="flex items-start gap-2 text-xs">
											<span
												aria-hidden="true"
												className="mt-1 size-2 shrink-0 rounded-full"
												style={{ backgroundColor: fill }}
											/>
											<div className="min-w-0">
												<p>{STATUS_COLOR_CONFIG[status].shortLabel}</p>
												<p className="tabular-nums text-muted-foreground">
													<strong className="font-semibold text-foreground">
														{count.toLocaleString("id-ID")}
													</strong>
													{` · ${Math.round((count / statusTotal) * 100)}%`}
												</p>
											</div>
										</li>
									))}
								</ul>
								{!statusData.length && (
									<p className="text-xs text-muted-foreground">
										Belum ada scan.
									</p>
								)}
							</div>
						</section>
						<p className="text-xs text-muted-foreground">
							Berdasarkan scan berhasil yang tercatat. Waktu dalam WIB;{" "}
							{memberId
								? `periode ini mencakup hari ini yang belum selesai, dibandingkan dengan ${data.days.length} hari penuh sebelumnya.`
								: "grafik harian untuk 7 hari terakhir; total per status sepanjang waktu."}
						</p>
					</>
				)
			)}
		</div>
	);
}
