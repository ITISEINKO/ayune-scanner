"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import type { MemberScanPeriod, MemberScanSummary } from "@/types/ppic";

const dateLabel = (date: string, days: number) =>
	new Intl.DateTimeFormat("id-ID", days === 7
		? { weekday: "short", timeZone: "Asia/Jakarta" }
		: { day: "numeric", month: "short", timeZone: "Asia/Jakarta" },
	).format(new Date(`${date}T00:00:00+07:00`));

export function MemberScanOverview({ memberId }: { memberId: string }) {
	const [period, setPeriod] = useState<MemberScanPeriod>("7");
	const { data, isPending, isError, refetch } = useQuery({
		queryKey: ["member-scan-summary", memberId, period],
		staleTime: 0,
		queryFn: async ({ signal }): Promise<MemberScanSummary> => {
			const params = new URLSearchParams({ user_id: memberId, period });
			const response = await fetch(`/api/panel/members/summary?${params}`, { cache: "no-store", signal });
			if (!response.ok) throw new Error("summary");
			return response.json();
		},
	});
	const peak = data?.days.reduce((best, day) => day.count > best.count ? day : best);
	const maxStatus = Math.max(1, ...(data?.statuses.map((bucket) => bucket.count) ?? []));
	const change = data?.previousTotal
		? Math.round(((data.total - data.previousTotal) / data.previousTotal) * 100)
		: null;

	return (
		<div className="space-y-4 px-6 pt-4 pb-6">
			<div className="flex gap-2" aria-label="Periode ringkasan">
				{([ ["7", "7 hari"], ["30", "30 hari"], ["month", "Bulan ini"] ] as const).map(([value, label]) => (
					<Button key={value} size="sm" variant={period === value ? "default" : "outline"}
						className="rounded-full" aria-pressed={period === value} onClick={() => setPeriod(value)}>
						{label}
					</Button>
				))}
			</div>
			{isPending ? (
				<div role="status" aria-label="Memuat ringkasan scan" className="space-y-3">
					<Skeleton className="h-24 rounded-2xl" />
					<Skeleton className="h-44 rounded-2xl" />
					<Skeleton className="h-36 rounded-2xl" />
				</div>
			) : isError ? (
				<div role="alert" className="rounded-2xl border p-4 text-sm">
					<p>Gagal memuat ringkasan scan.</p>
					<Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Coba lagi</Button>
				</div>
			) : data && (
				<>
					<p className="text-xs text-muted-foreground">
						{data.lastScannedAt ? `Scan terakhir ${new Intl.DateTimeFormat("id-ID", {
							dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
						}).format(new Date(data.lastScannedAt))} WIB` : "Belum ada riwayat scan."}
					</p>
					<div className="grid grid-cols-2 gap-3">
						<section className="rounded-2xl border bg-card p-4">
							<h3 className="text-xs text-muted-foreground">Total scan</h3>
							<p className="mt-1 text-3xl font-bold tabular-nums">{data.total}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{change === null ? "Periode sebelumnya: 0" : `${change > 0 ? "+" : ""}${change}% vs periode sebelumnya`}
							</p>
						</section>
						<section className="rounded-2xl border bg-card p-4">
							<h3 className="text-xs text-muted-foreground">Hari ini</h3>
							<p className="mt-1 text-3xl font-bold tabular-nums">{data.today}</p>
							<p className="mt-1 text-xs text-muted-foreground">Rata-rata {(data.total / data.days.length).toLocaleString("id-ID", { maximumFractionDigits: 1 })}/hari</p>
						</section>
					</div>
					{data.total === 0 && <p className="text-sm text-muted-foreground">Belum ada scan pada periode ini.</p>}
					<section className="rounded-2xl border bg-card p-4">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
							<h3 className="font-bold">Scan per hari</h3>
							{peak && peak.count > 0 && <p className="text-xs text-muted-foreground">Puncak {dateLabel(peak.date, data.days.length)}, {peak.count}</p>}
						</div>
						<div className="overflow-x-auto pb-1" tabIndex={0} role="region" aria-label="Grafik scan harian, geser untuk melihat semua hari">
							<div className="flex h-36 gap-2" style={{ minWidth: data.days.length > 7 ? data.days.length * 36 : undefined }}>
								{data.days.map((day, index) => (
									<div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={`${dateLabel(day.date, data.days.length)}: ${day.count} scan`}>
										<span className="text-[10px] tabular-nums text-muted-foreground">{day.count}</span>
										<div className={`w-full max-w-9 rounded-t-md ${index === data.days.length - 1 ? "bg-primary" : "bg-muted-foreground/30"}`}
											style={{ height: `${(day.count / Math.max(1, peak?.count ?? 0)) * 96}px`, minHeight: 2 }} />
										<span className="whitespace-nowrap text-[10px] text-muted-foreground">{dateLabel(day.date, data.days.length)}</span>
									</div>
								))}
							</div>
						</div>
					</section>
					<section className="rounded-2xl border bg-card p-4">
						<h3 className="mb-4 font-bold">Scan per status</h3>
						<ul className="space-y-3">
							{data.statuses.map(({ status, count }) => {
								const config = STATUS_COLOR_CONFIG[status];
								return <li key={status} className="flex items-center gap-3 text-xs">
									<span className="flex w-24 shrink-0 items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: config.color }} />{config.shortLabel}</span>
									<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
										<div className="h-full rounded-full" style={{ width: `${count / maxStatus * 100}%`, backgroundColor: config.color }} />
									</div>
									<span className="w-8 text-right font-semibold tabular-nums">{count}</span>
								</li>;
							})}
						</ul>
					</section>
					<p className="text-xs text-muted-foreground">Berdasarkan scan berhasil yang tercatat. Waktu dalam WIB; perbandingan dengan {data.days.length} hari sebelumnya.</p>
				</>
			)}
		</div>
	);
}
