"use client";

import Link from "next/link";
import { Check, ChevronLeft, Download, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completedProjectReview } from "@/lib/completedProjectReview";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import { asDate } from "@/lib/projectTimeline";
import { trackingStatuses } from "@/lib/projectStatus";
import type { ProjectDashboard } from "@/types/project";

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

export const CompletedProjectDetailPage = ({
	dashboard,
}: {
	dashboard: ProjectDashboard;
}) => {
	const review = completedProjectReview(dashboard);
	const { project, completion } = dashboard;
	return (
		<main className="completed-project-review mx-auto min-h-dvh max-w-lg bg-background pb-28 text-foreground">
			<header className="rounded-b-4xl bg-accent/25 px-5 pt-5 pb-7">
				<Link
					href="/admin/projects"
					className="review-actions -ml-2 mb-5 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring"
				>
					<ChevronLeft aria-hidden="true" className="size-4" /> Projects
				</Link>
				<p className="mb-3 text-xs font-bold tracking-widest text-muted-foreground">
					{project.custom_id ?? project.task_id}
				</p>
				<h1 className="text-2xl leading-tight font-extrabold tracking-tight wrap-anywhere">
					{project.name ?? "Tanpa nama"}
				</h1>
				<p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
					<Check aria-hidden="true" className="size-4" />
					{review.completedAt
						? `Selesai ${formatDate(review.completedAt, true)}`
						: "Selesai · tanggal tidak tercatat"}
				</p>
			</header>
			<div className="review-content space-y-6 px-5 pt-6">
				<section aria-labelledby="review-time">
					<h2 id="review-time" className="review-heading">
						Ringkasan waktu
					</h2>
					<dl className="review-summary mt-3 grid grid-cols-2 gap-3">
						<div className="review-stat">
							<dt>Mulai</dt>
							<dd>
								{formatDate(review.startAt)}
								<p>{review.startSource ?? "Belum ada data"}</p>
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
							<dt>Item terscan</dt>
							<dd>
								{review.scanned}/{review.total}
								<p>Status scan akhir item</p>
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
					<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
						Milestone dihitung dari scan pertama setiap item dalam snapshot.
						Jika riwayat tidak lengkap, milestone tidak ditampilkan.
					</p>
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
					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
						Hanya item berserial. Grup pendukung tidak masuk perhitungan.
					</p>
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
							Belum ada riwayat scan yang tercatat.
						</p>
					)}
					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
						Kontribusi menghitung aktivitas scan. Satu item dapat discan lebih
						dari sekali.
					</p>
				</section>
				<footer className="space-y-3 border-t border-border pt-4">
					<p className="text-xs leading-relaxed text-muted-foreground">
						<ScanLine aria-hidden="true" className="mr-1 inline size-3" />
						{completion?.source === "first-view"
							? "Snapshot dibuat saat review pertama dibuka; kondisi item saat project selesai tidak tersedia."
							: "Snapshot disimpan saat proses penyelesaian project."}
						{` Disimpan ${formatDate(completion?.capturedAt, true)}.`}
					</p>
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
				.completed-project-review .review-heading { font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
				.completed-project-review .review-stat { border: 1px solid var(--border); border-radius: 1rem; background: var(--card); padding: 1rem; }
				.completed-project-review .review-stat dt { font-size: 12px; color: var(--muted-foreground); }
				.completed-project-review .review-stat dd { margin-top: 5px; font-size: 20px; font-weight: 800; }
				.completed-project-review .review-stat p { margin-top: 4px; font-size: 10px; font-weight: 400; color: var(--muted-foreground); }
				@media print {
					@page { size: A4; margin: 16mm; }
					body:has(.completed-project-review) { background: white !important; }
					body:has(.completed-project-review) nav, .completed-project-review .review-actions { display: none !important; }
					.completed-project-review { --background: #fff; --foreground: #222; --card: #fff; --border: #d8d8d8; --muted-foreground: #555; --accent: #aaa; max-width: none; min-height: 0; padding: 0; font-size: 11pt; color: #222; background: white; print-color-adjust: exact; }
					.completed-project-review header { border-bottom: 2px solid #333; border-radius: 0; background: white; padding: 0 0 5mm; }
					.completed-project-review h1 { font-size: 21pt; }
					.completed-project-review .review-content { padding: 5mm 0 0; }
					.completed-project-review .review-content > * { margin-block: 0 !important; }
					.completed-project-review .review-content > * + * { margin-top: 3mm !important; }
					.completed-project-review .review-summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
					.completed-project-review .review-stat { padding: 3mm; border-radius: 2mm; break-inside: avoid; }
					.completed-project-review section h2 { break-after: avoid; }
					.completed-project-review ol { margin-top: 3mm; }
					.completed-project-review ol > * { margin-block: 0 !important; }
					.completed-project-review ol > * + * { margin-top: 2mm !important; }
					.completed-project-review [aria-labelledby="review-status"] dl > div, .completed-project-review tbody th, .completed-project-review tbody td { padding-top: 2mm; padding-bottom: 2mm; }
					.completed-project-review footer { break-inside: avoid; }
				`}</style>
		</main>
	);
};
