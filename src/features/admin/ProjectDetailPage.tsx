"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import {
	CalendarDays,
	ChevronLeft,
	RefreshCw,
	ScanLine,
	Timer,
	Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import {
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

const statusLabel = (status: string) => {
	const label =
		status === "OTHER"
			? "Status lainnya"
			: (statusBarangScanOptions.find((option) => option.key === status)
					?.label ?? status);
	return label
		.toLowerCase()
		.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
};

const trackingStatuses = [
	"UNSCANNED",
	"BARANG_DITERIMA",
	"SEDANG_DIPACKING",
	"TERPASANG_DIGUNAKAN",
	"OTHER",
] as const;
const statusColors: Record<(typeof trackingStatuses)[number], string> = {
	UNSCANNED: "bg-[#d9e7f2]",
	BARANG_DITERIMA: "bg-[#e8d4a8]",
	SEDANG_DIPACKING: "bg-[#c8b8df]",
	TERPASANG_DIGUNAKAN: "bg-[#6f9276]",
	OTHER: "bg-[#9a8f78]",
};
const trackingChartConfig = {
	UNSCANNED: { label: "Belum scan", color: "#d9e7f2" },
	BARANG_DITERIMA: { label: "Barang Diterima", color: "#e8d4a8" },
	SEDANG_DIPACKING: { label: "Sedang Dipacking", color: "#c8b8df" },
	TERPASANG_DIGUNAKAN: {
		label: "Terpasang / Digunakan",
		color: "#6f9276",
	},
	OTHER: { label: "Status lainnya", color: "#9a8f78" },
} satisfies ChartConfig;

const countsFor = (
	components: ProjectDashboard["items"][number]["components"],
) => {
	const counts = new Map<(typeof trackingStatuses)[number], number>(
		trackingStatuses.map((status) => [status, 0]),
	);
	for (const component of components) {
		const status = !component.status
			? "UNSCANNED"
			: trackingStatuses.includes(
						component.status as (typeof trackingStatuses)[number],
				  )
				? (component.status as (typeof trackingStatuses)[number])
				: "OTHER";
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
	const [isSyncing, setIsSyncing] = useState(false);
	const router = useRouter();
	const syncDashboard = async () => {
		if (isSyncing) return;
		setIsSyncing(true);
		try {
			const response = await fetch("/api/project/sync", { method: "POST" });
			if (!response.ok) throw new Error("SYNC_FAILED");
			router.refresh();
		} catch {
		} finally {
			setIsSyncing(false);
		}
	};
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
	const components = items.flatMap((item) => item.components);
	const statusTotals = countsFor(components);
	const totalComponents = components.length;
	const completedComponents = statusTotals.get("TERPASANG_DIGUNAKAN") ?? 0;
	const progressPercent = totalComponents
		? Math.round((completedComponents / totalComponents) * 100)
		: 0;
	const trackingChartData = [
		Object.fromEntries(
			trackingStatuses.map((status) => [status, statusTotals.get(status) ?? 0]),
		),
	];
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
		<main className="mx-auto min-h-dvh max-w-lg   pb-28">
			<header className="bg-accent/30 px-5 pt-3 pb-16">
				<div className="flex items-center justify-between gap-3">
					<Link
						href="/admin"
						aria-label="Kembali ke project"
						className="-ml-2 inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
					>
						<ChevronLeft aria-hidden="true" className="size-6" />
					</Link>
					<div className="flex items-center gap-2">
						{project.custom_id && (
							<Badge className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
								{project.custom_id}
							</Badge>
						)}
						<Button
							aria-label="Sinkronkan dashboard"
							disabled={isSyncing}
							onClick={syncDashboard}
							size="icon-sm"
							title="Sinkronkan dashboard"
							variant="ghost"
						>
							<RefreshCw
								aria-hidden="true"
								className={isSyncing ? "animate-spin" : ""}
							/>
						</Button>
					</div>
				</div>
				<h1 className="mt-5 text-2xl font-extrabold leading-tight tracking-tight">
					{project.name ?? "Tanpa nama"}
				</h1>
				<div className="mt-5 flex items-end gap-2">
					<strong className="text-7xl leading-none tracking-tight">
						{completedComponents}
					</strong>
					<span className="pb-1 text-xl font-bold">/ {totalComponents}</span>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					item selesai · {progressPercent}%
				</p>
				<div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted-foreground/20">
					{[
						"TERPASANG_DIGUNAKAN",
						"SEDANG_DIPACKING",
						"BARANG_DITERIMA",
						"OTHER",
						"UNSCANNED",
					].map((status) => (
						<div
							key={status}
							className={
								statusColors[status as (typeof trackingStatuses)[number]]
							}
							style={{
								flex:
									statusTotals.get(
										status as (typeof trackingStatuses)[number],
									) ?? 0,
							}}
						/>
					))}
				</div>
			</header>

			<div className="relative -mt-8 space-y-3 rounded-t-4xl bg-white p-4 pt-6">
				<section className="overflow-hidden rounded-[1.35rem] border border-border/40 bg-card shadow-sm">
					<div className="grid grid-cols-2 divide-x text-sm">
						<div className="p-4">
							<CalendarDays
								aria-hidden="true"
								className="size-4 text-primary"
							/>
							<p className="mt-3 text-xs text-muted-foreground">Mulai</p>
							<p className="mt-1 font-bold">
								{currentDashboard.currentStatusStartedAt
									? new Date(
											Number(currentDashboard.currentStatusStartedAt),
										).toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
									: "Tidak tersedia"}
							</p>
						</div>
						<div className="p-4">
							<Timer aria-hidden="true" className="size-4 text-primary" />
							<p className="mt-3 text-xs text-muted-foreground">
								Sudah berjalan
							</p>
							<p className="mt-1 font-bold">
								{currentDashboard.currentStatusDurationMinutes === null
									? "Tidak tersedia"
									: `${Math.floor(currentDashboard.currentStatusDurationMinutes / 1440)} hari`}
							</p>
						</div>
					</div>
				</section>
				<div>
					<div className="p-4">
						<div className="flex items-center justify-between gap-3">
							<p className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
								Progres Item
							</p>
						</div>

						<ChartContainer
							config={trackingChartConfig}
							className="mx-auto mt-2 aspect-2/1 max-h-45 w-full max-w-90"
						>
							<RadialBarChart
								data={trackingChartData}
								startAngle={180}
								endAngle={0}
								cy="80%"
								innerRadius={78}
								outerRadius={118}
							>
								{trackingStatuses.map((status) => (
									<RadialBar
										key={status}
										dataKey={status}
										stackId="tracking"
										fill={`var(--color-${status})`}
										cornerRadius={5}
										className="stroke-card stroke-2"
									/>
								))}
								<PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
									<Label
										content={({ viewBox }) => {
											if (viewBox && "cx" in viewBox && "cy" in viewBox) {
												return (
													<text
														x={viewBox.cx}
														y={viewBox.cy}
														textAnchor="middle"
													>
														<tspan
															x={viewBox.cx}
															y={(viewBox.cy || 0) - 8}
															className="fill-foreground text-2xl font-bold"
														>
															{totalComponents}
														</tspan>
														<tspan
															x={viewBox.cx}
															y={(viewBox.cy || 0) + 12}
															className="fill-muted-foreground"
														>
															Total item
														</tspan>
													</text>
												);
											}
											return null;
										}}
									/>
								</PolarRadiusAxis>
							</RadialBarChart>
						</ChartContainer>
						<div className="mt-3 grid grid-cols-5 gap-2 text-sm font-bold">
							{trackingStatuses.map((status) => (
								<div key={status}>
									<span
										className={`mr-1 inline-block size-2.5 rounded-full ${statusColors[status]}`}
									/>
									{statusTotals.get(status) ?? 0}
								</div>
							))}
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
					</div>
					<div className="mt-4 overflow-hidden rounded-[18px] border bg-card shadow-sm">
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
									<div className="grid grid-cols-5 gap-2 text-xs font-bold">
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
