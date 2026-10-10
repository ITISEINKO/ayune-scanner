"use client";

import { ClipboardCheck, ChevronLeft, ChevronRight, History } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PpicScanHistory } from "@/types/ppic";

const ITEMS_PER_PAGE = 15;

export const HistoryMemberPage = ({
	history,
}: {
	history: PpicScanHistory[];
}) => {
	const [page, setPage] = useState(1);
	const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
	const visibleHistory = history.slice(
		(page - 1) * ITEMS_PER_PAGE,
		page * ITEMS_PER_PAGE,
	);

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 px-4 pt-8 pb-28">
			<header className="rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-lg">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs font-bold tracking-widest text-primary-foreground/70 uppercase">
							Aktivitas member
						</p>
						<h1 className="mt-1 text-2xl font-black tracking-tight">
							Riwayat Scan
						</h1>
					</div>
					<div className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/10">
						<History aria-hidden="true" className="size-6" />
					</div>
				</div>
				<p className="mt-3 text-sm text-primary-foreground/75">
					Semua scan yang berhasil diubah akan tampil di sini.
				</p>
			</header>

			<section className="mt-5 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
				<div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
					<div>
						<p className=" text-xs tracking-[0.16em] text-muted-foreground uppercase">
							RIWAYAT ANDA
						</p>
						<h2 className="mt-1 text-sm font-bold">Scan terbaru</h2>
					</div>
					<span className="rounded-full bg-accent/30 px-3 py-1 text-xs font-bold text-accent-foreground">
						{history.length} aksi
					</span>
				</div>
				{history.length ? (
					<ul className="divide-y divide-border/70" aria-label="Riwayat scan">
						{visibleHistory.map(
							({ taskName, serialNumber, status, scannedAt }, index) => (
								<li
									key={`${serialNumber}-${scannedAt}-${index}`}
									className="flex items-center gap-3 px-5 py-3.5"
								>
									<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-foreground">
										<ClipboardCheck aria-hidden="true" className="size-4" />
									</div>
									<div className="min-w-0 flex-1 ">
										<p className="truncate text-xs text-muted-foreground">
											{serialNumber}
										</p>
										<time className="shrink-0 text-xs font-semibold text-muted-foreground">
											{new Intl.DateTimeFormat("id-ID", {
												dateStyle: "short",
												timeStyle: "short",
												timeZone: "Asia/Jakarta",
											}).format(new Date(`${scannedAt.replace(" ", "T")}Z`))}
										</time>
									</div>
									<Badge
										className="text-xs"
										variant={
											status === "BARANG_DITERIMA"
												? "green"
												: status === "SEDANG_DIPACKING"
													? "blue"
													: "purple"
										}
									>
										{status.replaceAll("_", " ")}
									</Badge>
								</li>
							),
						)}
					</ul>
				) : (
					<p className="px-5 py-8 text-center text-sm text-muted-foreground">
						Belum ada riwayat scan.
					</p>
				)}
				{totalPages > 1 && (
					<div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
						<Button
							aria-label="Halaman sebelumnya"
							disabled={page === 1}
							onClick={() => setPage((current) => current - 1)}
							size="icon-sm"
							variant="outline"
						>
							<ChevronLeft aria-hidden="true" />
						</Button>
						<span className="text-xs font-semibold text-muted-foreground">
							Halaman {page} dari {totalPages}
						</span>
						<Button
							aria-label="Halaman berikutnya"
							disabled={page === totalPages}
							onClick={() => setPage((current) => current + 1)}
							size="icon-sm"
							variant="outline"
						>
							<ChevronRight aria-hidden="true" />
						</Button>
					</div>
				)}
			</section>
		</main>
	);
};
