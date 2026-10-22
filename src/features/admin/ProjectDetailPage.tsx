"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Label, Pie, PieChart } from "recharts";
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
import { applyProjectStatusChanges } from "@/lib/projectStatus";
import { elapsedLabel, scanWindow } from "@/lib/projectTimeline";
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
	"DALAM_PROSES_RETUR",
	"OTHER",
] as const;
const statusColors: Record<(typeof trackingStatuses)[number], string> = {
	UNSCANNED: "bg-[#d9e7f2]",
	BARANG_DITERIMA: "bg-[#e8d4a8]",
	SEDANG_DIPACKING: "bg-[#c8b8df]",
	TERPASANG_DIGUNAKAN: "bg-[#6f9276]",
	DALAM_PROSES_RETUR: "bg-[#c96f6f]",
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
	DALAM_PROSES_RETUR: { label: "Dalam Proses Retur", color: "#c96f6f" },
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

export const ProjectDetailPage = ({
	dashboard,
	error,
}: {
	dashboard?: ProjectDashboard;
	error?: string;
}) => {
	const [currentDashboard, setCurrentDashboard] = useState(dashboard);
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	const router = useRouter();
	const syncDashboard = async () => {
		if (isSyncing || !currentDashboard) return;
		setIsSyncing(true);
		setSyncError(null);
		try {
			const response = await fetch("/api/project/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ task_id: currentDashboard.project.task_id }),
			});
			if (!response.ok) throw new Error("SYNC_FAILED");
			const result = await response.json() as { dashboard: ProjectDashboard };
			setCurrentDashboard(result.dashboard);
		} catch {
			setSyncError("Resync gagal. Data terakhir tetap ditampilkan. Coba lagi.");
		} finally {
			setIsSyncing(false);
		}
	};
	useEffect(() => setCurrentDashboard(dashboard), [dashboard]);
	useEffect(() => {
		if (!currentDashboard) return;
		let since = currentDashboard.statusUpdatedAt;
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
					`/api/project/changes?project=${encodeURIComponent(currentDashboard.project.task_id)}&since=${since}`,
					{ cache: "no-store" },
				);
				if (!response.ok) throw new Error("STATUS_POLL_FAILED");
				const { changes = [] } = (await response.json()) as {
					changes?: ProjectStatusChange[];
				};
				if (stopped) return;
				if (changes?.length) {
					since = Math.max(...changes.map((change) => change.updatedAt));
					setCurrentDashboard((current) =>
						current ? applyProjectStatusChanges(current, changes) : current,
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
	}, [currentDashboard?.project.task_id, currentDashboard?.syncedAt]);

	if (!currentDashboard)
		return (
			<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 p-4 pb-28">
				<Link href="/admin" className="text-sm font-semibold text-primary">
					← Kembali ke project
				</Link>
				<p className="mt-6 text-sm text-destructive">{error}</p>
				<Button className="mt-3" onClick={() => router.refresh()}>Coba lagi</Button>
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
	const trackingChartData = trackingStatuses
		.map((status) => ({
			status,
			value: statusTotals.get(status) ?? 0,
			fill: trackingChartConfig[status].color,
		}))
		.filter(({ value }) => value > 0);
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
		<main className="mx-auto min-h-dvh max-w-lg  bg-muted ">
			<header className="bg-primary px-5 pt-3 pb-16">
				<div className="flex items-center justify-between gap-3">
					<Link
						href="/admin"
						aria-label="Kembali ke project"
						className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/40"
					>
						<ChevronLeft aria-hidden="true" className="size-6" />
					</Link>
					<div className="flex items-center gap-2">
						{project.custom_id && (
							<Badge className="rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-xs font-bold text-primary-foreground">
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
							className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
						>
							<RefreshCw
								aria-hidden="true"
								className={isSyncing ? "animate-spin" : ""}
							/>
						</Button>
					</div>
				</div>
				<h1 className="mt-5  text-2xl font-extrabold leading-tight tracking-tight text-primary-foreground">
					{project.name ?? "Tanpa nama"}
				</h1>
				{currentDashboard.syncedAt && (
					<p className="mt-2 text-xs text-primary-foreground/80">
						Terakhir diperbarui {formatDate(String(currentDashboard.syncedAt), true)}
					</p>
				)}
				<div className="mt-5 flex items-end gap-2">
					<strong className="text-7xl leading-none tracking-tight text-primary-foreground">
						{completedComponents}
					</strong>
					<span className="pb-1 text-xl font-bold text-primary-foreground/80">
						/ {totalComponents}
					</span>
				</div>
			</header>

			<div className="relative -mt-8 space-y-3 rounded-t-4xl bg-background pb-28  p-4 pt-6">
				{syncError && <p role="alert" className="text-sm text-destructive">{syncError}</p>}
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
										).toLocaleString("id-ID", {
											day: "numeric",
											month: "long",
											year: "numeric",
											hour: "2-digit",
											minute: "2-digit",
											timeZone: "Asia/Jakarta",
										})
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
					<div>
						<div className="flex items-center justify-between gap-3">
							<p className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
								Progres Item
							</p>
						</div>

						<ChartContainer
							config={trackingChartConfig}
							className="mx-auto mt-2 aspect-2/1 max-h-45 w-full max-w-90"
						>
							<PieChart>
								<Pie
									data={trackingChartData}
									dataKey="value"
									nameKey="status"
									startAngle={180}
									endAngle={0}
									cy="80%"
									innerRadius={78}
									outerRadius={118}
									cornerRadius={5}
									className="stroke-card stroke-2"
								>
									<Label
										content={({ viewBox }) => {
											if (viewBox && "cx" in viewBox && "cy" in viewBox) {
												return (
													<text
														x={viewBox.cx}
														y={viewBox.cy}
														textAnchor="middle"
														stroke="none"
													>
														<tspan
															x={viewBox.cx}
															y={(viewBox.cy || 0) + 4}
															className="fill-primary text-2xl font-bold"
														>
															{totalComponents}
														</tspan>
														<tspan
															x={viewBox.cx}
															y={(viewBox.cy || 0) + 24}
															className="fill-primary"
														>
															Total item
														</tspan>
													</text>
												);
											}
											return null;
										}}
									/>
								</Pie>
							</PieChart>
						</ChartContainer>
						<div className="mt-3 flex flex-wrap gap-2">
							{trackingStatuses.map((status) => (
								<div
									key={status}
									className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-md px-3 py-2"
									style={{
										backgroundColor: `${trackingChartConfig[status].color}18`,
									}}
								>
									<div className="flex items-center gap-2">
										<span
											className={`size-3 shrink-0 rounded-full ${statusColors[status]}`}
										/>
										<strong className="text-base leading-none">
											{statusTotals.get(status) ?? 0}
										</strong>
									</div>
									<p className="mt-1 truncate text-[10px] text-muted-foreground">
										{statusLabel(status)}
									</p>
								</div>
							))}
						</div>
					</div>
					<div className="mt-4 space-y-2">
						{itemRows.map((row) => {
							const total = [...row.counts.values()].reduce(
								(sum, count) => sum + count,
								0,
							);
							return (
								<div
									key={row.id}
									className="space-y-2 rounded-[18px] bg-card p-3 shadow-sm"
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
									<div className="flex h-2 overflow-hidden rounded-full bg-muted">
										{trackingStatuses
											.filter((status) => (row.counts.get(status) ?? 0) > 0)
											.map((status) => (
												<div
													key={status}
													className={`rounded-sm ${statusColors[status]}`}
													style={{ flex: row.counts.get(status) ?? 0 }}
												/>
											))}
									</div>
									<div className="grid grid-cols-6 gap-2 text-xs font-bold">
										{trackingStatuses.map((status) => (
											<div key={status} className="flex items-center gap-1.5">
												<span
													className={`size-2.5 rounded-full  ${statusColors[status]}`}
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
