"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Label, Pie, PieChart } from "recharts";
import {
	CalendarDays,
	Check,
	CircleAlert,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	ScanLine,
	Timer,
	Users,
	ScanBox,
	Import,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ClickUpTask } from "@/types/clickup";
import {
	STATUS_BADGE_CLASS_NAME,
	STATUS_COLOR_CONFIG,
} from "@/lib/colorStatusConfig";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import {
	applyProjectStatusChanges,
	countsFor,
	isSupportingGroup,
	trackingStatuses,
	trackingStatusOf,
} from "@/lib/projectStatus";
import { elapsedLabel, scanWindow } from "@/lib/projectTimeline";
import { statusBarangScanOptions } from "@/lib/produksiPanel";
import type { ProjectDashboard, ProjectStatusChange } from "@/types/project";
import { CompletedProjectDetailPage } from "@/features/admin/CompletedProjectDetailPage";

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

function GroupStatusBar({ counts }: { counts: ReturnType<typeof countsFor> }) {
	return (
		<span
			role="img"
			aria-label={trackingStatuses
				.map(
					(status) =>
						`${STATUS_COLOR_CONFIG[status].label}: ${counts.get(status) ?? 0}`,
				)
				.join(", ")}
			className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
		>
			{[
				...trackingStatuses.filter((status) => status !== "UNSCANNED"),
				"UNSCANNED" as const,
			]
				.filter((status) => (counts.get(status) ?? 0) > 0)
				.map((status) => {
					const color = STATUS_COLOR_CONFIG[status];
					return (
						<span
							key={status}
							aria-hidden="true"
							style={{
								flex: counts.get(status),
								backgroundColor:
									"progressColor" in color ? color.progressColor : color.color,
							}}
						/>
					);
				})}
		</span>
	);
}

function GroupComponentList({
	components,
	supporting,
}: {
	components: ProjectDashboard["items"][number]["components"];
	supporting: boolean;
}) {
	const [showUnscannedOnly, setShowUnscannedOnly] = useState(false);
	const unscannedCount = components.filter(
		(component) => trackingStatusOf(component.status) === "UNSCANNED",
	).length;
	const visibleComponents = showUnscannedOnly
		? components.filter(
				(component) => trackingStatusOf(component.status) === "UNSCANNED",
			)
		: components;
	return (
		<>
			{!supporting && (
				<div className="shrink-0 px-4 py-3">
					<Button
						type="button"
						variant={showUnscannedOnly ? "secondary" : "outline"}
						size="sm"
						aria-pressed={showUnscannedOnly}
						disabled={!unscannedCount}
						onClick={() => setShowUnscannedOnly((show) => !show)}
					>
						{showUnscannedOnly
							? "Tampilkan semua item"
							: `Belum discan (${unscannedCount})`}
					</Button>
				</div>
			)}
			<ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
				{visibleComponents.map((component) => {
					const status = trackingStatusOf(component.status);
					const presentation = STATUS_COLOR_CONFIG[status];
					return (
						<li
							key={component.id}
							className="flex items-center gap-3 rounded-2xl bg-card px-3 py-3"
						>
							{!supporting && (
								<span
									aria-hidden="true"
									className="size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: presentation.color }}
								/>
							)}
							<div className="min-w-0 flex-1">
								<p className="wrap-break-word text-sm font-bold">
									{component.serialNumber ?? component.name}
								</p>
								{component.serialNumber &&
									component.serialNumber !== component.name && (
										<p className="wrap-break-word text-xs text-muted-foreground">
											{component.name}
										</p>
									)}
							</div>
							{!supporting && (
								<Badge
									variant="outline"
									style={
										{
											"--status-color": presentation.color,
											"--status-text-color": presentation.textColor,
										} as CSSProperties
									}
									className={`h-auto max-w-[42%] rounded-full px-2 py-1 text-[10px] whitespace-normal ${STATUS_BADGE_CLASS_NAME}`}
								>
									{presentation.shortLabel}
								</Badge>
							)}
						</li>
					);
				})}
				{!visibleComponents.length && (
					<li className="py-3 text-sm text-muted-foreground">
						{showUnscannedOnly
							? "Tidak ada item yang belum discan."
							: "Belum ada item pada subtask ini."}
					</li>
				)}
			</ul>
		</>
	);
}

export const ProjectDetailPage = ({
	dashboard,
	error,
}: {
	dashboard?: ProjectDashboard;
	error?: string;
}) => {
	const [currentDashboard, setCurrentDashboard] = useState(dashboard);
	const [isSyncing, setIsSyncing] = useState(false);
	const [completeOpen, setCompleteOpen] = useState(false);
	const [completing, setCompleting] = useState(false);
	const [completeError, setCompleteError] = useState("");
	const queryClient = useQueryClient();
	const router = useRouter();
	const syncDashboard = async () => {
		if (isSyncing || !currentDashboard) return;
		setIsSyncing(true);
		try {
			const response = await fetch("/api/project/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ task_id: currentDashboard.project.task_id }),
			});
			if (!response.ok) throw new Error("SYNC_FAILED");
			const result = (await response.json()) as { dashboard: ProjectDashboard };
			setCurrentDashboard(result.dashboard);
			toast.success("Status berhasil diperbarui.");
		} catch {
			toast.error("Gagal memperbarui status", {
				description: "Data terakhir tetap ditampilkan. Coba lagi.",
			});
		} finally {
			setIsSyncing(false);
		}
	};
	useEffect(() => setCurrentDashboard(dashboard), [dashboard]);
	useEffect(() => {
		if (
			!currentDashboard ||
			currentDashboard.project.status?.toLowerCase() === "complete"
		)
			return;
		let since = currentDashboard.statusUpdatedAt;
		let delay = 10_000;
		let timer: number | undefined;
		let stopped = false;
		let fetching = false;
		// shortcut: sharing the adaptive status timer can delay snapshot checks by 60s; split timers if exact cadence is needed.
		let lastDashboardCheck = Date.now();
		const controller = new AbortController();
		const tick = async () => {
			if (stopped || fetching) return;
			if (document.hidden) {
				timer = window.setTimeout(tick, 30_000);
				return;
			}
			fetching = true;
			try {
				if (Date.now() - lastDashboardCheck >= 5 * 60_000) {
					lastDashboardCheck = Date.now();
					const response = await fetch(
						`/api/project/sync?task_id=${encodeURIComponent(currentDashboard.project.task_id)}`,
						{ cache: "no-store", signal: controller.signal },
					);
					if (!response.ok) throw new Error("SNAPSHOT_POLL_FAILED");
					const { dashboard: shared } = (await response.json()) as {
						dashboard: ProjectDashboard;
					};
					if (stopped) return;
					since = shared.statusUpdatedAt;
					setCurrentDashboard(shared);
				}
				const response = await fetch(
					`/api/project/changes?project=${encodeURIComponent(currentDashboard.project.task_id)}&since=${since}`,
					{ cache: "no-store", signal: controller.signal },
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
			} finally {
				fetching = false;
				if (!stopped) timer = window.setTimeout(tick, delay);
			}
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
			controller.abort();
			if (timer !== undefined) window.clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [
		currentDashboard?.project.task_id,
		currentDashboard?.project.status,
		currentDashboard?.syncedAt,
	]);

	if (!currentDashboard)
		return (
			<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 p-4 pb-28">
				<Link
					href="/admin/projects"
					className="text-sm font-semibold text-primary"
				>
					← Kembali ke project
				</Link>
				<p className="mt-6 text-sm text-destructive">{error}</p>
				<Button className="mt-3" onClick={() => router.refresh()}>
					Coba lagi
				</Button>
			</main>
		);

	const { project, items, recentHistory, memberContribution, memberNames } =
		currentDashboard;
	const components = items
		.filter((item) => !isSupportingGroup(item.name))
		.flatMap((item) => item.components);
	const statusTotals = countsFor(components);
	const totalComponents = components.length;
	const completedComponents = statusTotals.get("TERPASANG_DIGUNAKAN") ?? 0;
	const serials = items
		.flatMap((item) => item.components)
		.filter((component) => component.serialNumber?.trim());
	const unscannedSerials = serials.filter(
		(component) => !component.status,
	).length;
	const returnSerials = serials.filter(
		(component) => component.status === "DALAM_PROSES_RETUR",
	).length;
	const projectComplete = project.status?.toLowerCase() === "complete";
	const confirmComplete = async () => {
		if (completing || unscannedSerials) return;
		setCompleting(true);
		setCompleteError("");
		try {
			const response = await fetch("/api/project/complete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ task_id: project.task_id }),
			});
			if (response.redirected)
				throw new Error("Sesi berakhir. Silakan login kembali.");
			const result = (await response.json()) as {
				error?: string;
				dashboard?: ProjectDashboard;
			};
			if (!response.ok)
				throw new Error(
					result.error === "PROJECT_HAS_UNSCANNED_SERIALS"
						? "Masih ada serial tanpa Status Barang Scan di ClickUp. Gunakan Resync sebelum mencoba lagi."
						: "Project belum dapat ditandai selesai. Coba lagi atau periksa status di ClickUp.",
				);
			await queryClient.cancelQueries({ queryKey: ["projects"] });
			queryClient.setQueryData<ClickUpTask[]>(["projects"], (tasks) =>
				tasks?.filter((task) => task.id !== project.task_id),
			);
			queryClient.removeQueries({
				queryKey: ["projects", "complete"],
				exact: true,
			});
			setCurrentDashboard(
				(current) =>
					result.dashboard ??
					(current
						? {
								...current,
								project: { ...current.project, status: "complete" },
							}
						: current),
			);
			setCompleteOpen(false);
			toast.success("Project berhasil ditandai selesai.");
		} catch (cause) {
			setCompleteError(
				cause instanceof Error
					? cause.message
					: "Project tidak dapat ditandai selesai.",
			);
		} finally {
			setCompleting(false);
		}
	};
	const trackingChartData = trackingStatuses
		.map((status) => {
			const color = STATUS_COLOR_CONFIG[status];
			return {
				status,
				value: statusTotals.get(status) ?? 0,
				fill: "progressColor" in color ? color.progressColor : color.color,
			};
		})
		.filter(({ value }) => value > 0);
	const itemRows = items
		.map((item) => {
			const counts = countsFor(item.components);
			const total = item.components.length;
			const remaining = counts.get("UNSCANNED") ?? 0;
			const parts = item.name.split("+").map((part) => part.trim());
			const hasMetadata =
				parts.length === 3 && /^\d+(?:[.,]\d+)?$/.test(parts[2]);
			const title = hasMetadata
				? parts[0]
						.split("-")
						.map((word, index) =>
							index === 0
								? word
								: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
						)
						.join(" ")
				: item.name;
			const tags = hasMetadata ? [parts[1], `${parts[2]} mm`] : [];
			return {
				...item,
				supporting: isSupportingGroup(item.name),
				counts,
				total,
				remaining,
				scanned: total - remaining,
				title,
				tags,
				label: [title, ...tags].join(" · "),
			};
		})
		.sort(
			(a, b) =>
				Number(a.supporting) - Number(b.supporting) ||
				b.remaining - a.remaining,
		);

	if (currentDashboard.completion && projectComplete)
		return <CompletedProjectDetailPage dashboard={currentDashboard} />;

	return (
		<main className="mx-auto min-h-dvh max-w-lg  bg-muted ">
			<header className="bg-primary px-5 pt-3 pb-16">
				<div className="flex items-center justify-between gap-3">
					<Link
						href="/admin/projects"
						aria-label="Kembali ke project"
						className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/40"
					>
						<ChevronLeft aria-hidden="true" className="size-6" />
					</Link>
					<div className="flex items-center gap-2">
						<Badge className="rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-xs font-bold text-primary-foreground">{project.custom_id || project.task_id}</Badge>
						<Button
							aria-label="Sinkronkan dashboard"
							disabled={isSyncing || completing}
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
						Terakhir diperbarui{" "}
						{formatDate(String(currentDashboard.syncedAt), true)}
					</p>
				)}
			</header>

			<div className="relative -mt-8 space-y-3 rounded-t-4xl bg-background pb-28  p-4 pt-6">
				<section className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4">
					<div className="min-w-0">
						<h2 className="text-sm font-extrabold">
							{projectComplete
								? "Project sudah selesai"
								: "Pengerjaan sudah beres?"}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{projectComplete
								? "Data dan riwayat tetap tersimpan."
								: unscannedSerials
									? `Masih ada ${unscannedSerials} barang belum discan.`
									: "Semua serial sudah memiliki status scan."}
						</p>
					</div>
					{!projectComplete && (
						<Button
							variant="secondary"
							className="shrink-0 rounded-xl"
							onClick={() => {
								setCompleteError("");
								setCompleteOpen(true);
							}}
						>
							<Check aria-hidden="true" /> Tandai selesai
						</Button>
					)}
				</section>
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
							config={STATUS_COLOR_CONFIG}
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
										backgroundColor: `color-mix(in srgb, ${STATUS_COLOR_CONFIG[status].color} 12%, transparent)`,
									}}
								>
									<div className="flex items-center gap-2">
										<span
											className="size-3 shrink-0 rounded-full"
											style={{
												backgroundColor:
													status === "UNSCANNED"
														? STATUS_COLOR_CONFIG.UNSCANNED.progressColor
														: STATUS_COLOR_CONFIG[status].color,
											}}
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
					<section className="mt-6" aria-label="Kelompok item">
						<div className="mb-3 flex items-center justify-between gap-3">
							<h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
								Kelompok Item
							</h2>
						</div>
						<div
							className="divide-y overflow-hidden rounded-3xl bg-card"
							aria-label="Daftar subtask"
						>
							{itemRows.map((row) => (
								<Drawer key={row.id} showSwipeHandle>
									<DrawerTrigger
										aria-label={`Lihat detail ${row.label}`}
										className="block w-full space-y-2 p-4 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									>
										<span className="flex items-start justify-between gap-3">
											<span className="min-w-0 wrap-break-word text-sm font-bold">
												{row.label}
											</span>
											<span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
												{!row.supporting && (
													<span>
														<strong>{row.scanned}</strong>
														<span className="text-muted-foreground">
															/{row.total}
														</span>
													</span>
												)}
												<ChevronRight
													aria-hidden="true"
													className="size-3 text-muted-foreground"
												/>
											</span>
										</span>
										<span className="flex items-center justify-between gap-2">
											<span className="shrink-0 text-[11px] text-muted-foreground">
												{row.supporting ? "Grup pendukung" : ``}
											</span>
										</span>
										{!row.supporting && <GroupStatusBar counts={row.counts} />}
									</DrawerTrigger>
									<DrawerContent className="[--drawer-inset:0px]! mx-auto max-w-lg rounded-t-3xl bg-background">
										<DrawerHeader className="gap-2 text-left!">
											<DrawerTitle className="wrap-break-word text-lg font-bold">
												{row.label}
											</DrawerTitle>
											<DrawerDescription>
												{row.supporting ? (
													"Grup pendukung · tidak termasuk progres scan"
												) : (
													<>
														<strong className="text-foreground">
															{row.scanned}/{row.total}
														</strong>{" "}
														sudah di-scan
													</>
												)}
											</DrawerDescription>
											{!row.supporting && (
												<GroupStatusBar counts={row.counts} />
											)}
										</DrawerHeader>
										<GroupComponentList
											components={row.components}
											supporting={row.supporting}
										/>
										<DrawerFooter>
											<DrawerClose render={<Button variant="outline" />}>
												Tutup
											</DrawerClose>
										</DrawerFooter>
									</DrawerContent>
								</Drawer>
							))}
							{!itemRows.length && (
								<p className="p-4 text-sm text-muted-foreground">
									Belum ada item pada project ini.
								</p>
							)}
						</div>
					</section>
				</div>
				<section className="hidden rounded-xl border bg-card p-4 shadow-xs">
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

				<section className="rounded-xl border border-border/30 bg-card p-4 shadow-xs">
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

				<section className="overflow-hidden rounded-xl border border-border/30 bg-card shadow-xs">
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
			<Dialog
				open={completeOpen}
				onOpenChange={(open) => {
					if (!completing) setCompleteOpen(open);
				}}
			>
				<DialogContent
					showCloseButton={!completing}
					className="top-auto bottom-0 max-h-dvh max-w-lg translate-y-0 gap-4 overflow-y-auto rounded-b-none bg-background p-5 pt-7 **:data-[slot=dialog-close]:rounded-full **:data-[slot=dialog-close]:bg-muted **:data-[slot=dialog-close]:text-foreground sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-b-3xl"
				>
					<DialogTitle className="pr-10 text-xl leading-snug font-extrabold wrap-anywhere">
						Tandai {project.name ?? "project ini"} selesai?
					</DialogTitle>
					<DialogDescription className="space-y-2 text-foreground">
						{(unscannedSerials > 0 || returnSerials > 0) && (
							<span className="flex items-start gap-3 rounded-2xl bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
								<CircleAlert
									aria-hidden="true"
									className="mt-0.5 size-4 shrink-0"
								/>
								<span>
									<strong>
										{unscannedSerials
											? "Belum bisa ditandai selesai"
											: "Masih ada barang dalam proses retur"}
									</strong>
									<span className="mt-1 block">
										{unscannedSerials > 0 &&
											`${unscannedSerials} barang belum memiliki Status Barang Scan. `}
										{returnSerials > 0 &&
											`${returnSerials} barang masih dalam proses retur.`}
									</span>
								</span>
							</span>
						)}
						<span className="flex items-start gap-3 rounded-2xl bg-card p-3">
							<Check
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0 text-emerald-600"
							/>
							<span>
								Status project di ClickUp berubah jadi{" "}
								<strong>Complete.</strong>
							</span>
						</span>
						<span className="flex items-start gap-3 rounded-2xl bg-card p-3">
							<Check
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0 text-emerald-600"
							/>
							<span>
								Project hilang dari daftar pilihan petugas, jadi tidak bisa
								discan lagi.
							</span>
						</span>
						<span className="flex items-start gap-3 rounded-2xl bg-card p-3">
							<Check
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0 text-emerald-600"
							/>
							<span>
								Data dan riwayat tetap tersimpan. Bisa{" "}
								<strong>dibuka lagi</strong> kapan saja.
							</span>
						</span>
					</DialogDescription>
					{completeError && (
						<p role="alert" className="text-sm text-destructive">
							{completeError}
						</p>
					)}
					<DialogFooter className="-mx-5 -mb-5 grid grid-cols-2 border-t px-5 py-3 sm:grid">
						<Button
							variant="outline"
							className="h-auto min-h-14 rounded-2xl bg-card"
							disabled={completing}
							onClick={() => setCompleteOpen(false)}
						>
							Batal
						</Button>
						<Button
							className="h-auto min-h-14 rounded-2xl bg-primary whitespace-normal text-primary-foreground hover:bg-primary/90"
							disabled={completing || unscannedSerials > 0 || isSyncing}
							onClick={() => void confirmComplete()}
						>
							{completing ? "Menyimpan..." : "Ya, tandai selesai"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
};
