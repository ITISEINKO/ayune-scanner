"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
	CalendarDays,
	ChevronLeft,
	Flag,
	ScanLine,
	Timer,
	Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	calendarDaysBetween,
	elapsedLabel,
	scanWindow,
} from "@/lib/projectTimeline";
import { statusBarangScanOptions } from "@/lib/produksiPanel";
import type { ProjectDashboard, ProjectStatusChange } from "@/types/project";

const formatDate = (value: string | null, includeTime = false) => {
	if (!value) return "Tidak tersedia";
	const date = new Date(
		/^\d+$/.test(value) ? Number(value) : `${value.replace(" ", "T")}Z`,
	);
	if (Number.isNaN(date.getTime())) return "Tidak tersedia";
	return new Intl.DateTimeFormat("id-ID", {
		timeZone: "Asia/Jakarta",
		dateStyle: "medium",
		...(includeTime ? { timeStyle: "short" as const } : {}),
	}).format(date);
};

const statusLabel = (status: string) =>
	statusBarangScanOptions.find((option) => option.key === status)?.label ??
	status;

const trackingStatuses = [
	"UNSCANNED",
	...statusBarangScanOptions
		.filter((option) => option.key !== "DIHAPUSKAN")
		.map((option) => option.key),
] as const;
const statusColors: Record<(typeof trackingStatuses)[number], string> = {
	UNSCANNED: "bg-[#e8e1d7]",
	BARANG_DITERIMA: "bg-[#cdbfa6]",
	DALAM_PROSES_PRODUKSI: "bg-[#b9aa8d]",
	DRY_FIT: "bg-[#aaa087]",
	SEDANG_DIPACKING: "bg-[#9b9076]",
	SIAP_DIKIRIM: "bg-[#8b8068]",
	DITERIMA_DI_LOKASI_TUJUAN: "bg-[#786f5b]",
	TERPASANG_DIGUNAKAN: "bg-[#2b2d1e]",
	DALAM_PROSES_RETUR: "bg-[#665e4d]",
};

const countsFor = (
	components: ProjectDashboard["items"][number]["components"],
) => {
	const counts = new Map<(typeof trackingStatuses)[number], number>(
		trackingStatuses.map((status) => [status, 0]),
	);
	for (const component of components) {
		const status = trackingStatuses.includes(
			component.status as (typeof trackingStatuses)[number],
		)
			? (component.status as (typeof trackingStatuses)[number])
			: "UNSCANNED";
		counts.set(status, (counts.get(status) ?? 0) + 1);
	}
	return counts;
};

const applyStatusChanges = (
	dashboard: ProjectDashboard,
	changes: ProjectStatusChange[],
): ProjectDashboard => ({
	...dashboard,
	items: dashboard.items.map((item) => ({
		...item,
		components: item.components
			.map((component) => {
				const change = changes.find(
					(candidate) => candidate.componentTaskId === component.id,
				);
				return change ? { ...component, status: change.status } : component;
			})
			.filter((component) => component.status !== "DIHAPUSKAN"),
	})),
});

export const ProjectDetailPage = ({
	dashboard,
	error,
}: {
	dashboard?: ProjectDashboard;
	error?: string;
}) => {
	const [currentDashboard, setCurrentDashboard] = useState(dashboard);
	useEffect(() => setCurrentDashboard(dashboard), [dashboard]);
	useEffect(() => {
		if (!dashboard) return;
		let since = dashboard.statusUpdatedAt;
		let delay = 10_000;
		let timer: number | undefined;
		let stopped = false;
		const tick = async () => {
			if (stopped) return;
			if (document.hidden) {
				timer = window.setTimeout(tick, 30_000);
				return;
			}
			try {
				const response = await fetch(
					`/api/project/changes?project=${encodeURIComponent(dashboard.project.task_id)}&since=${since}`,
					{ cache: "no-store" },
				);
				if (!response.ok) throw new Error("STATUS_POLL_FAILED");
				const { changes = [] } = (await response.json()) as {
					changes?: ProjectStatusChange[];
				};
				if (changes?.length) {
					since = Math.max(...changes.map((change) => change.updatedAt));
					setCurrentDashboard((current) =>
						current ? applyStatusChanges(current, changes) : current,
					);
					delay = 5_000;
				} else delay = Math.min(delay * 1.5, 60_000);
			} catch {
				delay = Math.min(delay * 1.5, 60_000);
			}
			timer = window.setTimeout(tick, delay);
		};
		const onVisibilityChange = () => {
			if (!document.hidden) {
				if (timer !== undefined) window.clearTimeout(timer);
				tick();
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		timer = window.setTimeout(tick, delay);
		return () => {
			stopped = true;
			if (timer !== undefined) window.clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [dashboard]);

	if (!currentDashboard)
		return (
			<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 p-4 pb-28">
				<Link href="/admin" className="text-sm font-semibold text-primary">
					← Kembali ke project
				</Link>
				<p className="mt-6 text-sm text-destructive">{error}</p>
			</main>
		);

	const { project, items, recentHistory, memberContribution, memberNames } =
		currentDashboard;
	const projectElapsed = calendarDaysBetween(project.startDate, new Date());
	const targetDuration = calendarDaysBetween(
		project.startDate,
		project.dueDate,
	);
	const components = items.flatMap((item) => item.components);
	const statusTotals = countsFor(components);
	const totalComponents = components.length;
	const itemRows = items.map((item) => ({
		...item,
		counts: countsFor(item.components),
		complete:
			item.components.length > 0 &&
			item.components.every(
				(component) => component.status === "TERPASANG_DIGUNAKAN",
			),
	}));
	const completedItems = itemRows.filter((item) => item.complete).length;

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 pb-28">
			<header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card px-4 py-3">
				<Link
					href="/admin"
					aria-label="Kembali ke project"
					className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
				>
					<ChevronLeft aria-hidden="true" className="size-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<h2 className="text-lg font-semibold">Detail Project</h2>
				</div>
			</header>

			<div className="space-y-3 p-4">
				<section className="overflow-hidden rounded-[1.35rem] border border-border/40 bg-card shadow-sm">
					<div className="bg-accent/25 px-5 pt-5 pb-6">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
									Overview project
								</p>
								<h1 className="mt-2 text-xl font-extrabold leading-snug tracking-tight">
									{project.name ?? "Tanpa nama"}
								</h1>
							</div>
							{project.custom_id && (
								<Badge className="mt-0.5 rounded-md bg-primary px-2 text-[11px] font-bold text-primary-foreground">
									{project.custom_id}
								</Badge>
							)}
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							Pantau jadwal dan durasi pekerjaan project ini.
						</p>
					</div>
					<div className="grid grid-cols-2 divide-x divide-y border-t text-sm">
						<div className="p-4">
							<CalendarDays
								aria-hidden="true"
								className="size-4 text-primary"
							/>
							<p className="mt-3 text-xs text-muted-foreground">Mulai</p>
							<p className="mt-1 font-bold">{formatDate(project.startDate)}</p>
						</div>
						<div className="p-4">
							<Flag aria-hidden="true" className="size-4 text-primary" />
							<p className="mt-3 text-xs text-muted-foreground">Due date</p>
							<p className="mt-1 font-bold">{formatDate(project.dueDate)}</p>
						</div>
						<div className="p-4">
							<Timer aria-hidden="true" className="size-4 text-primary" />
							<p className="mt-3 text-xs text-muted-foreground">
								Target durasi
							</p>
							<p className="mt-1 font-bold">
								{targetDuration === null
									? "Tidak tersedia"
									: `${targetDuration} hari kalender`}
							</p>
						</div>
						<div className="p-4">
							<Timer aria-hidden="true" className="size-4 text-primary" />
							<p className="mt-3 text-xs text-muted-foreground">
								Sudah berjalan
							</p>
							<p className="mt-1 font-bold">
								{projectElapsed === null
									? "Belum mulai"
									: `${projectElapsed} hari`}
							</p>
						</div>
					</div>
				</section>
				<div>
					<div className="p-4">
						<div className="flex items-center justify-between gap-3">
							<p className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
								Tracking per item
							</p>
							<p className="text-sm text-muted-foreground">
								{completedItems} dari {itemRows.length} item selesai
							</p>
						</div>
						<div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
							<div>
								<span
									className={`mr-1 inline-block size-2.5 rounded-full ${statusColors.UNSCANNED}`}
								/>
								Belum scan
							</div>
							{trackingStatuses.slice(1).map((status) => (
								<div key={status} className="capitalize">
									<span
										className={`mr-1 inline-block size-2.5  rounded-full ${statusColors[status]}`}
									/>
									{statusLabel(status)}
								</div>
							))}
						</div>
						<div className="mt-3 flex h-3 gap-1 rounded-md bg-muted">
							{trackingStatuses
								.filter((status) => (statusTotals.get(status) ?? 0) > 0)
								.map((status) => (
									<div
										key={status}
										className={`rounded-[3px] ${statusColors[status]}`}
										style={{ flex: statusTotals.get(status) ?? 0 }}
									/>
								))}
						</div>
						<div className="mt-3 grid grid-cols-4 gap-2 text-sm font-bold">
							{trackingStatuses.map((status) => (
								<div key={status}>
									<span
										className={`mr-1 inline-block size-2.5 rounded-full ${statusColors[status]}`}
									/>
									{statusTotals.get(status) ?? 0}
								</div>
							))}
						</div>
						<div className="mt-4 overflow-hidden rounded-[18px] border bg-card shadow-sm">
							<div className="space-y-2 border-b bg-[#faf7f2] p-3">
								<div className="flex items-baseline justify-between gap-2">
									<p className="text-sm font-extrabold">Semua item</p>
									<p className="shrink-0 text-xs text-muted-foreground">
										<strong className="text-base text-foreground">
											{statusTotals.get("TERPASANG_DIGUNAKAN") ?? 0}
										</strong>
										/{totalComponents}
									</p>
								</div>
								<div className="flex h-3 gap-1">
									{trackingStatuses
										.filter((status) => (statusTotals.get(status) ?? 0) > 0)
										.map((status) => (
											<div
												key={status}
												className={`rounded-[3px] ${statusColors[status]}`}
												style={{ flex: statusTotals.get(status) ?? 0 }}
											/>
										))}
								</div>
								<div className="grid grid-cols-4 gap-2 text-xs font-bold">
									{trackingStatuses.map((status) => (
										<div key={status} className="flex items-center gap-1.5">
											<span
												className={`size-2.5 rounded-full border border-foreground/20 ${statusColors[status]}`}
											/>
											{statusTotals.get(status) ?? 0}
										</div>
									))}
								</div>
							</div>
							{itemRows.map((row, index) => {
								const total = [...row.counts.values()].reduce(
									(sum, count) => sum + count,
									0,
								);
								return (
									<div
										key={row.id}
										className={`space-y-2 p-3 ${index < itemRows.length - 1 ? "border-b" : ""}`}
									>
										<div className="flex items-baseline justify-between gap-2">
											<p className="min-w-0 truncate text-sm font-extrabold">
												{row.name}
											</p>
											<p className="shrink-0 text-xs text-muted-foreground">
												<strong className="text-base text-foreground">
													{row.counts.get("TERPASANG_DIGUNAKAN") ?? 0}
												</strong>
												/{total}
											</p>
										</div>
										<div className="flex h-2 gap-1">
											{trackingStatuses
												.filter((status) => (row.counts.get(status) ?? 0) > 0)
												.map((status) => (
													<div
														key={status}
														className={`rounded-[3px] ${statusColors[status]}`}
														style={{ flex: row.counts.get(status) ?? 0 }}
													/>
												))}
										</div>
										<div className="grid grid-cols-4 gap-2 text-xs font-bold">
											{trackingStatuses.map((status) => (
												<div key={status} className="flex items-center gap-1.5">
													<span
														className={`size-2.5 rounded-full border border-foreground/20 ${statusColors[status]}`}
													/>
													{row.counts.get(status) ?? 0}
												</div>
											))}
										</div>
									</div>
								);
							})}
							{!itemRows.length && (
								<p className="p-4 text-sm text-muted-foreground">
									Belum ada item pada project ini.
								</p>
							)}
						</div>
					</div>
				</div>
				<section className="hidden rounded-xl border bg-card p-4 shadow-sm">
					<h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
						Riwayat scan per item
					</h2>
					<div className="mt-4 space-y-4">
						{items.map((item) => {
							const history = item.components.flatMap(
								(component) => component.history,
							);
							const { first, last } = scanWindow(history);
							return (
								<article key={item.id} className="rounded-lg border p-3">
									<div className="flex justify-between gap-3">
										<h3 className="font-bold">{item.name}</h3>
										<Badge variant="muted">
											{item.components.length} komponen
										</Badge>
									</div>
									{first && last ? (
										<p className="mt-2 text-sm text-muted-foreground">
											{formatDate(first.scannedAt)} —{" "}
											{formatDate(last.scannedAt)} ·{" "}
											{elapsedLabel(first.scannedAt, last.scannedAt)} aktivitas
											tercatat
										</p>
									) : (
										<p className="mt-2 text-sm text-muted-foreground">
											Belum ada scan.
										</p>
									)}
								</article>
							);
						})}
						{!items.length && (
							<p className="text-sm text-muted-foreground">
								Belum ada item pada project ini.
							</p>
						)}
					</div>
				</section>

				<section className="rounded-xl border bg-card p-4 shadow-sm">
					<h2 className="flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
						<Users aria-hidden="true" className="size-4" /> Kontribusi member
					</h2>
					<div className="mt-3 space-y-2 text-sm">
						{memberContribution.map((member) => (
							<div key={member.userId} className="flex justify-between gap-3">
								<span className="capitalize">{member.name}</span>
								<span className="font-bold">{member.scans} scan</span>
							</div>
						))}
						{!memberContribution.length && (
							<p className="text-muted-foreground">Belum ada scan tercatat.</p>
						)}
					</div>
				</section>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="flex items-center gap-2 px-4 py-3">
						<ScanLine aria-hidden="true" className="size-4" />
						<h2 className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
							5 log terbaru
						</h2>
					</div>
					<ul className="divide-y border-t">
						{recentHistory.map((log, index) => (
							<li
								key={`${log.componentTaskId}-${log.scannedAt}-${index}`}
								className="px-4 py-3 text-sm"
							>
								<p className="font-semibold">{log.taskName}</p>
								<p className="mt-1 text-xs text-muted-foreground capitalize">
									{statusLabel(log.status)} ·{" "}
									{memberNames[log.userId] ?? log.userId} ·{" "}
									{formatDate(log.scannedAt, true)}
								</p>
							</li>
						))}
						{!recentHistory.length && (
							<li className="px-4 py-3 text-sm text-muted-foreground">
								Belum ada scan tercatat.
							</li>
						)}
					</ul>
				</section>
			</div>
		</main>
	);
};
