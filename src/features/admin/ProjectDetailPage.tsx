import Link from "next/link";
import { ChevronLeft, ScanLine, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	calendarDaysBetween,
	elapsedLabel,
	scanWindow,
} from "@/lib/projectTimeline";
import { statusBarangScanOptions } from "@/lib/produksiPanel";
import type { ProjectDashboard } from "@/types/project";

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

export const ProjectDetailPage = ({
	dashboard,
	error,
}: {
	dashboard?: ProjectDashboard;
	error?: string;
}) => {
	if (!dashboard)
		return (
			<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 p-4 pb-28">
				<Link href="/admin" className="text-sm font-semibold text-primary">
					← Kembali ke project
				</Link>
				<p className="mt-6 text-sm text-destructive">{error}</p>
			</main>
		);

	const { project, items, recentHistory, memberContribution, memberNames } =
		dashboard;
	const projectElapsed = calendarDaysBetween(project.startDate, new Date());
	const targetDuration = calendarDaysBetween(
		project.startDate,
		project.dueDate,
	);

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
				<section className="rounded-xl border bg-card p-4 shadow-sm">
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-sm font-extrabold">
							{project.name ?? "Tanpa nama"}
						</h1>
					</div>
					<p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
						Timeline project
					</p>
					<div className="mt-4 grid grid-cols-2 gap-4 text-sm">
						<div>
							<p className="text-muted-foreground">Mulai</p>
							<p className="mt-1 font-bold">{formatDate(project.startDate)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Due date</p>
							<p className="mt-1 font-bold">{formatDate(project.dueDate)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Target</p>
							<p className="mt-1 font-bold">
								{targetDuration === null
									? "Tidak tersedia"
									: `${targetDuration} hari kalender`}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">Berjalan</p>
							<p className="mt-1 font-bold">
								{projectElapsed === null
									? "Belum mulai"
									: `${projectElapsed} hari`}
							</p>
						</div>
					</div>
				</section>

				<section className="rounded-xl border bg-card p-4 shadow-sm">
					<h2 className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
						Level 2 · Per item
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
