"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/pageHeader";
import { MemberActivityTabs } from "@/features/member/MemberActivityTabs";
import {
	STATUS_BADGE_CLASS_NAME,
	STATUS_COLOR_CONFIG,
} from "@/lib/colorStatusConfig";
import type { PpicScanHistory } from "@/types/ppic";

const MemberScanOverview = dynamic(
	() =>
		import("@/features/settings/MemberScanOverview").then(
			(module) => module.MemberScanOverview,
		),
	{
		loading: () => (
			<p role="status" className="px-4 pt-2 text-sm text-muted-foreground">
				Memuat ringkasan scan...
			</p>
		),
	},
);

const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	timeZone: JAKARTA_TIME_ZONE,
});

const parseScannedAt = (value: string) =>
	new Date(`${value.replace(" ", "T")}Z`);

const getDateKey = (date: Date) => dateKeyFormatter.format(date);

const getDateLabel = (dateKey: string, today: string, yesterday: string) => {
	if (dateKey === today) return "Hari ini";
	if (dateKey === yesterday) return "Kemarin";
	return new Intl.DateTimeFormat("id-ID", {
		day: "numeric",
		month: "short",
		timeZone: JAKARTA_TIME_ZONE,
	}).format(new Date(`${dateKey}T12:00:00+07:00`));
};

const formatScanTime = (scannedAt: string) =>
	new Intl.DateTimeFormat("id-ID", {
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		timeZone: JAKARTA_TIME_ZONE,
	}).format(parseScannedAt(scannedAt));

export const MemberActivityPage = ({
	history,
	initialHasMore,
	activeTab,
}: {
	history: PpicScanHistory[];
	initialHasMore: boolean;
	activeTab: "summary" | "activity";
}) => {
	const [visibleHistory, setVisibleHistory] = useState(history);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const [loadingMore, setLoadingMore] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const today = getDateKey(new Date());
	const yesterday = getDateKey(new Date(Date.now() - 86_400_000));
	const groups = visibleHistory.reduce<
		{ date: string; label: string; entries: PpicScanHistory[] }[]
	>((currentGroups, entry) => {
		const date = getDateKey(parseScannedAt(entry.scannedAt));
		const group = currentGroups.find((item) => item.date === date);
		if (group) {
			group.entries.push(entry);
		} else {
			currentGroups.push({
				date,
				label: getDateLabel(date, today, yesterday),
				entries: [entry],
			});
		}
		return currentGroups;
	}, []);

	return (
		<main className="mx-auto min-h-dvh max-w-120 bg-background pb-28">
			<PageHeader
				eyebrow="Aktivitas member"
				title={activeTab === "summary" ? "Ringkasan Scan" : "Aktivitas Scan"}
			>
				<div className="relative z-10 mt-5">
					<MemberActivityTabs activeTab={activeTab} />
				</div>
			</PageHeader>

			{activeTab === "summary" ? (
				<section className="mx-4 mt-4" aria-labelledby="member-overview-title">
					<h2 id="member-overview-title" className="px-4 text-lg font-bold">
						Overview kamu
					</h2>
					<MemberScanOverview />
				</section>
			) : (
				<section
					className="mx-4 mt-5 space-y-4"
					aria-label="Riwayat scan berdasarkan tanggal"
				>
					{visibleHistory.length ? (
						groups.map((group) => (
							<div key={group.date} className="space-y-2">
								<h2 className="px-1 text-xs font-semibold text-muted-foreground">
									{group.label}
								</h2>
								<ul className="overflow-hidden divide-y divide-border/70 rounded-3xl border border-border/30 bg-card">
									{group.entries.map(
										({ taskName, serialNumber, status, scannedAt }, index) => (
											<li
												key={`${serialNumber}-${scannedAt}-${index}`}
												className="flex min-h-17 items-center gap-3 px-4 py-2.5"
											>
												<time className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
													{formatScanTime(scannedAt)}
												</time>
												<div className="min-w-0 flex-1">
													<p className="truncate font-semibold">
														{serialNumber}
													</p>
													<p className="truncate text-xs text-muted-foreground">
														{taskName}
													</p>
												</div>
												<Badge
													variant="outline"
													className={`${STATUS_BADGE_CLASS_NAME} h-auto shrink-0 rounded-lg px-3 py-1 text-xs`}
													style={
														{
															"--status-color":
																STATUS_COLOR_CONFIG[status].color,
															"--status-text-color":
																STATUS_COLOR_CONFIG[status].textColor,
														} as CSSProperties
													}
												>
													{STATUS_COLOR_CONFIG[status].shortLabel}
												</Badge>
											</li>
										),
									)}
								</ul>
							</div>
						))
					) : (
						<p className="rounded-3xl border border-border/30 bg-card px-5 py-8 text-center text-sm text-muted-foreground">
							Belum ada riwayat scan.
						</p>
					)}
					{hasMore && (
						<div className="space-y-2 px-1 py-2">
							{loadError && (
								<p role="alert" className="text-sm text-destructive">
									Gagal memuat aktivitas. Coba lagi.
								</p>
							)}
							<Button
								variant="outline"
								className="rounded-full"
								disabled={loadingMore}
								onClick={async () => {
									setLoadingMore(true);
									setLoadError(false);
									try {
										const response = await fetch(
											`/api/profile/scan-history?offset=${visibleHistory.length}`,
											{ cache: "no-store" },
										);
										if (!response.ok) throw new Error("HISTORY_LOAD_FAILED");
										const page = (await response.json()) as {
											history: PpicScanHistory[];
											hasMore: boolean;
										};
										setVisibleHistory((current) => [...current, ...page.history]);
										setHasMore(page.hasMore);
									} catch {
										setLoadError(true);
									} finally {
										setLoadingMore(false);
									}
								}}
			>
					{loadingMore ? "Memuat..." : "Muat lagi"}
			</Button>
						</div>
					)}
				</section>
			)}
		</main>
	);
};
