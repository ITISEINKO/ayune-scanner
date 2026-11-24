"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
	ChevronDown,
	ChevronLeft,
	Download,
	Info,
	ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { completedProjectReview } from "@/lib/completedProjectReview";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import { asDate } from "@/lib/projectTimeline";
import { trackingStatuses } from "@/lib/projectStatus";
import type { ProjectDashboard } from "@/types/project";
import { ThemeColor } from "@/components/themeColor";

const formatDate = (value: string | null | undefined, includeYear = false) => {
	const date = asDate(value);
	return date
		? new Intl.DateTimeFormat("id-ID", {
				timeZone: "Asia/Jakarta",
				day: "numeric",
				month: "short",
				...(includeYear ? { year: "numeric" } : {}),
			}).format(date)
		: "Tidak tercatat";
};

const formatNumber = (value: number) =>
	new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
const formatHours = (value: number | null) =>
	value === null
		? "Belum ada data"
		: value > 0 && value < 0.1
			? "<0,1 jam"
			: `${formatNumber(value)} jam`;

export const CompletedProjectDetailPage = ({
	dashboard,
}: {
	dashboard: ProjectDashboard;
}) => {
	const review = completedProjectReview(dashboard);
	const { project, completion } = dashboard;
	const insights = completion?.insights;
	const titleRef = useRef<HTMLHeadingElement>(null);
	const [titleScrolled, setTitleScrolled] = useState(false);

	useEffect(() => {
		const title = titleRef.current;
		if (!title) return;
		const observer = new IntersectionObserver(
			([entry]) => setTitleScrolled(entry.boundingClientRect.bottom < 64),
			{ rootMargin: "-64px 0px 0px 0px" },
		);
		observer.observe(title);
		return () => observer.disconnect();
	}, []);

	return (
		<main className="completed-project-review mx-auto min-h-dvh max-w-lg bg-background pb-28 text-foreground">
			<ThemeColor color="color-mix(in srgb, var(--accent) 25%, var(--background))" />
			<div
				className="review-actions sticky top-0 z-30 flex min-h-16 items-center gap-3 px-5"
				style={{
					backgroundColor:
						"color-mix(in srgb, var(--accent) 25%, var(--background))",
				}}
			>
				<Link
					href="/admin/projects"
					aria-label="Kembali ke project"
					className="-ml-2 inline-flex size-10 items-center justify-center rounded-full bg-foreground/10 transition-colors hover:bg-foreground/15 focus-visible:outline-2 focus-visible:outline-ring"
				>
					<ChevronLeft aria-hidden="true" className="size-6" />
				</Link>
				<span
					aria-hidden="true"
					className={`min-w-0 flex-1 truncate text-sm font-bold transition-opacity duration-200 motion-reduce:transition-none ${titleScrolled ? "opacity-100" : "opacity-0"}`}
				>
					{project.name ?? "Tanpa nama"}
				</span>
				<span className="shrink-0 rounded-full border border-foreground/25 bg-foreground/10 px-3 py-1 text-xs font-bold">
					{project.custom_id ?? project.task_id}
				</span>
			</div>
			<header className="bg-accent/25 px-5 pt-1 pb-16">
				<h1
					ref={titleRef}
					className="text-xl leading-tight font-extrabold tracking-tight wrap-anywhere"
				>
					{project.name ?? "Tanpa nama"}
				</h1>
				<p className="mt-2 text-xs text-foreground/80">
					{review.completedAt
						? `Selesai ${formatDate(review.completedAt, true)}`
						: "Selesai · tanggal tidak tercatat"}
				</p>
			</header>
			<div className="review-content relative -mt-8 space-y-6 rounded-t-4xl bg-background px-5 pt-6">
				<details className="review-reading rounded-3xl bg-muted/70">
					<summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-3xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
						<Info aria-hidden="true" className="size-5 shrink-0" />
						<span className="flex-1">Cara membaca laporan ini</span>
						<ChevronDown
							aria-hidden="true"
							className="reading-chevron size-4 shrink-0 transition-transform"
						/>
					</summary>
					<div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
						<p>
							Milestone dihitung dari riwayat scan yang tersedia. Jika riwayat
							tidak lengkap, milestone mungkin tidak ditampilkan.
						</p>
						<p>
							Angka retur berdasarkan status item saat data disimpan dan riwayat
							scan yang tersedia. Retur sebelumnya mungkin belum terhitung, jadi
							0% bukan bukti tidak pernah ada retur. Beres berarti status
							Terpasang; Diterima atau Dipacking masih proses.
						</p>
						<p>
							Durasi tahap adalah rata-rata waktu dari pasangan scan berurutan
							pertama per item sampai snapshot atau penyelesaian. Scan ulang
							status yang sama tidak mereset waktu. Jeda yang melewati retur
							atau alur mundur, serta waktu tunggu yang belum selesai, tidak
							dihitung. Jumlah sampel tiap tahap bisa berbeda.
						</p>
						<p>
							Kontribusi menghitung aktivitas scan; satu item dapat discan lebih
							dari sekali. Status item hanya menghitung item berserial, tanpa
							grup pendukung.
						</p>
					</div>
				</details>
				<p className="flex gap-3 px-1 text-xs leading-relaxed text-muted-foreground">
					<ScanLine aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
					<span>
						{completion?.source === "first-view"
							? "Data item disimpan saat laporan pertama dibuka, bukan saat project selesai. Kondisi item saat project selesai tidak diketahui."
							: "Snapshot disimpan saat proses penyelesaian project."}
						{` Disimpan ${formatDate(completion?.capturedAt, true)}.`}
					</span>
				</p>
				<section aria-labelledby="review-time">
					<h2 id="review-time" className="review-heading">
						Ringkasan waktu
					</h2>
					<dl className="review-summary mt-3 grid grid-cols-2 gap-3">
						<div className="review-stat">
							<dt>Mulai</dt>
							<dd>
								{formatDate(review.startAt)}
								<p>
									{review.startSource ??
										"Tanggal mulai tidak tersedia di ClickUp."}
								</p>
							</dd>
						</div>
						<div className="review-stat">
							<dt>Selesai</dt>
							<dd>
								{formatDate(review.completedAt)}
								<p>Status project selesai</p>
							</dd>
						</div>
						<div className="review-stat">
							<dt>Total durasi</dt>
							<dd>
								{review.durationDays === null
									? "—"
									: `${review.durationDays} hari`}
								<p>Hari kalender · WIB</p>
							</dd>
						</div>
						<div className="review-stat">
							<dt>Item berstatus scan</dt>
							<dd>
								{review.scanned}/{review.total}
								<p>
									Item dengan status scan saat data disimpan, bukan jumlah
									aktivitas scan.
								</p>
							</dd>
						</div>
					</dl>
				</section>
				<section aria-labelledby="review-timeline">
					<h2 id="review-timeline" className="review-heading">
						Timeline
					</h2>
					<ol className="mt-4 space-y-5 border-l border-border pl-5">
						{review.timeline.map((event) => (
							<li key={event.label} className="relative break-inside-avoid">
								<span
									aria-hidden="true"
									className="absolute top-1.5 left-[-1.6rem] size-2.5 rounded-full bg-accent ring-4 ring-background"
								/>
								<p className="text-sm font-bold">
									{formatDate(event.at)} · {event.label}
								</p>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									{event.description}
								</p>
							</li>
						))}
					</ol>
				</section>
				<section aria-labelledby="review-status">
					<h2 id="review-status" className="review-heading">
						{completion?.source === "first-view"
							? "Status item saat snapshot"
							: "Status akhir item"}
					</h2>
					<dl className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card px-4">
						{trackingStatuses
							.filter(
								(status) =>
									!["UNSCANNED", "OTHER"].includes(status) ||
									(review.counts.get(status) ?? 0) > 0,
							)
							.map((status) => (
								<div
									key={status}
									className="flex items-center justify-between gap-4 py-3 text-sm break-inside-avoid"
								>
									<dt className="flex items-center gap-2">
										<span
											aria-hidden="true"
											className="size-2 shrink-0 rounded-full"
											style={{
												backgroundColor: STATUS_COLOR_CONFIG[status].color,
											}}
										/>
										{STATUS_COLOR_CONFIG[status].label}
									</dt>
									<dd className="font-bold tabular-nums">
										{review.counts.get(status) ?? 0}
									</dd>
								</div>
							))}
					</dl>
				</section>
				<section aria-labelledby="review-returns">
					<h2 id="review-returns" className="review-heading">
						Retur material
					</h2>
					{insights ? (
						<>
							<dl className="review-summary mt-3 grid grid-cols-3 gap-2">
								<div
									className="review-stat"
									style={{
										backgroundColor: `color-mix(in srgb, ${STATUS_COLOR_CONFIG.DALAM_PROSES_RETUR.color} 7%, var(--card))`,
									}}
								>
									<dt>Item retur</dt>
									<dd
										style={{
											color: STATUS_COLOR_CONFIG.DALAM_PROSES_RETUR.textColor,
										}}
									>
										{insights.returns.percentage === null
											? "—"
											: `${formatNumber(insights.returns.percentage)}%`}
										<p>
											{insights.returns.returnedItems}/
											{insights.returns.totalItems} item unik
										</p>
									</dd>
								</div>
								<div
									className="review-stat"
									style={{
										backgroundColor: `color-mix(in srgb, ${STATUS_COLOR_CONFIG.SEDANG_DIPACKING.color} 7%, var(--card))`,
									}}
								>
									<dt>Masih proses</dt>
									<dd
										style={{
											color: STATUS_COLOR_CONFIG.SEDANG_DIPACKING.textColor,
										}}
									>
										{insights.returns.inProgress}
										<p>Belum terpasang</p>
									</dd>
								</div>
								<div
									className="review-stat"
									style={{
										backgroundColor: `color-mix(in srgb, ${STATUS_COLOR_CONFIG.TERPASANG_DIGUNAKAN.color} 7%, var(--card))`,
									}}
								>
									<dt>Sudah beres</dt>
									<dd
										style={{
											color: STATUS_COLOR_CONFIG.TERPASANG_DIGUNAKAN.textColor,
										}}
									>
										{insights.returns.resolved}
										<p>Status Terpasang</p>
									</dd>
								</div>
							</dl>
							{insights.returns.unknown > 0 && (
								<p className="mt-2 text-xs text-muted-foreground">
									{insights.returns.unknown} item retur belum dapat dipastikan
									status akhirnya.
								</p>
							)}
							{insights.returns.groups.length ? (
								<>
									<p className="mt-3 text-xs font-semibold">
										Kelompok dengan item retur terbanyak
									</p>
									<ol className="mt-2 divide-y divide-border rounded-2xl border border-border px-3">
										{insights.returns.groups.map((group) => (
											<li
												key={group.id}
												className="py-3 text-xs break-inside-avoid"
											>
												<div className="flex items-start justify-between gap-3">
													<p className="min-w-0 font-semibold wrap-anywhere">
														{group.name}
													</p>
													<p className="shrink-0 font-bold tabular-nums">
														{group.returnedItems}/{group.totalItems} ·{" "}
														{formatNumber(group.percentage)}%
													</p>
												</div>
												<p className="mt-1 text-muted-foreground">
													{group.inProgress} proses · {group.resolved} beres
													{group.unknown
														? ` · ${group.unknown} belum diketahui`
														: ""}
												</p>
											</li>
										))}
									</ol>
								</>
							) : (
								<p className="mt-3 text-sm text-muted-foreground">
									Tidak ada item retur yang ditemukan dalam data laporan ini.
								</p>
							)}
						</>
					) : (
						<p className="mt-3 text-sm text-muted-foreground">
							Insight retur belum tersedia.
						</p>
					)}
				</section>
				<section aria-labelledby="review-durations">
					<h2 id="review-durations" className="review-heading">
						Durasi antar tahap
					</h2>
					{insights ? (
						<>
							<dl className="mt-3 grid grid-cols-2 gap-3">
								{insights.transitions.map((transition) => (
									<div key={transition.from} className="review-stat">
										<dt>
											{STATUS_COLOR_CONFIG[transition.from].shortLabel} →{" "}
											{STATUS_COLOR_CONFIG[transition.to].shortLabel}
										</dt>
										<dd>
											{formatHours(transition.averageHours)}
											<p>
												{transition.sampleItems} item dengan pasangan scan
												lengkap
											</p>
										</dd>
										<p>
											{transition.waitingItems} item masih{" "}
											{STATUS_COLOR_CONFIG[transition.from].shortLabel} di
											snapshot
										</p>
									</div>
								))}
							</dl>
							<p className="mt-3 text-sm font-semibold">
								{insights.bottleneck
									? `Tahap dengan rata-rata terlama: ${STATUS_COLOR_CONFIG[insights.bottleneck].shortLabel}.`
									: insights.transitions.every(
												(transition) => transition.averageHours !== null,
										  )
										? "Rata-rata kedua tahap sama."
										: "Pasangan scan belum cukup untuk membandingkan kedua tahap."}
							</p>
						</>
					) : (
						<p className="mt-3 text-sm text-muted-foreground">
							Insight durasi belum tersedia.
						</p>
					)}
				</section>
				<section aria-labelledby="review-members">
					<h2 id="review-members" className="review-heading">
						Kontribusi member
					</h2>
					{review.members.length ? (
						<table className="mt-3 w-full text-sm">
							<thead className="text-left text-xs text-muted-foreground">
								<tr>
									<th scope="col" className="pb-2 font-medium">
										Member
									</th>
									<th scope="col" className="pb-2 text-right font-medium">
										Jumlah scan
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{review.members.map((member) => (
									<tr key={member.userId} className="break-inside-avoid">
										<th
											scope="row"
											className="py-3 pr-3 text-left font-semibold wrap-anywhere"
										>
											{member.name}
										</th>
										<td className="py-3 text-right font-bold whitespace-nowrap tabular-nums">
											{member.scans} scan
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<p className="mt-3 text-sm text-muted-foreground">
							Riwayat aktivitas scan tidak tersedia di laporan ini.
						</p>
					)}
				</section>
				<footer className="space-y-3 border-t border-border pt-4">
					<div className="review-actions space-y-2">
						<Button
							className="min-h-12 w-full rounded-2xl"
							onClick={() => window.print()}
						>
							<Download aria-hidden="true" /> Unduh laporan
						</Button>
						<p className="text-center text-xs text-muted-foreground">
							Pilih Simpan sebagai PDF / Save as PDF pada dialog cetak.
						</p>
					</div>
				</footer>
			</div>
			<style>{`
				.completed-project-review .review-reading summary::-webkit-details-marker { display: none; }
				.completed-project-review .review-reading[open] .reading-chevron { transform: rotate(180deg); }
				.completed-project-review .review-heading { font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
				.completed-project-review .review-stat { border: 1px solid color-mix(in srgb, var(--border) 55%, var(--background)); border-radius: 1rem; background: var(--card); padding: 1rem; }
				.completed-project-review [aria-labelledby="review-status"] dl, .completed-project-review [aria-labelledby="review-returns"] ol { border-color: color-mix(in srgb, var(--border) 55%, var(--background)); }
				.completed-project-review .review-stat dt { font-size: 12px; color: var(--muted-foreground); }
				.completed-project-review .review-stat dd { margin-top: 5px; font-size: 20px; font-weight: 800; }
				.completed-project-review .review-stat p { margin-top: 4px; font-size: 10px; font-weight: 400; color: var(--muted-foreground); }
				@media print {
					@page { size: A4; margin: 16mm; }
					body:has(.completed-project-review) { background: white !important; }
					body:has(.completed-project-review) nav, .completed-project-review .review-actions { display: none !important; }
					.completed-project-review .review-reading > div { display: block !important; }
					.completed-project-review { --background: #fff; --foreground: #222; --card: #fff; --border: #d8d8d8; --muted-foreground: #555; --accent: #aaa; max-width: none; min-height: 0; padding: 0; font-size: 11pt; color: #222; background: white; print-color-adjust: exact; }
					.completed-project-review header { border-bottom: 2px solid #333; border-radius: 0; background: white; padding: 0 0 5mm; break-inside: avoid; }
					.completed-project-review h1 { font-size: 21pt; }
					.completed-project-review .review-content { display: flex; flex-direction: column; position: static; margin: 0 !important; padding: 5mm 0 0; border-radius: 0; background: white; gap: 3mm; }
					.completed-project-review .review-content > * { margin: 0 !important; }
					.completed-project-review [aria-labelledby="review-time"] { order: 0; }
					.completed-project-review [aria-labelledby="review-timeline"] { order: 1; }
					.completed-project-review [aria-labelledby="review-status"] { order: 2; }
					.completed-project-review [aria-labelledby="review-returns"] { order: 3; }
					.completed-project-review [aria-labelledby="review-durations"] { order: 4; }
					.completed-project-review [aria-labelledby="review-members"] { order: 5; }
					.completed-project-review .review-content > p { order: 6; }
					.completed-project-review .review-reading { order: 7; background: white; }
					.completed-project-review .review-reading summary { display: none; }
					.completed-project-review .review-reading > div { padding: 2mm 0 0 !important; font-size: 8pt; line-height: 1.35; }
					.completed-project-review [aria-labelledby="review-time"] .review-summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
					.completed-project-review [aria-labelledby="review-returns"] .review-stat { background: #fff !important; }
					.completed-project-review [aria-labelledby="review-returns"] li { padding-block: 2mm; }
					.completed-project-review [aria-labelledby="review-returns"] .review-stat, .completed-project-review [aria-labelledby="review-durations"] .review-stat { padding: 2mm; }
					.completed-project-review .review-stat { padding: 3mm; border-radius: 2mm; break-inside: avoid; }
					.completed-project-review section h2 { break-after: avoid; }
					.completed-project-review ol { margin-top: 3mm; }
					.completed-project-review ol > * { margin-block: 0 !important; }
					.completed-project-review ol > * + * { margin-top: 2mm !important; }
					.completed-project-review [aria-labelledby="review-status"] dl > div, .completed-project-review tbody th, .completed-project-review tbody td { padding-top: 2mm; padding-bottom: 2mm; }
					.completed-project-review footer { display: none !important; }
				`}</style>
		</main>
	);
};
