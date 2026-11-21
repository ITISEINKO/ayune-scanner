"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/pageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	STATUS_BADGE_CLASS_NAME,
	STATUS_COLOR_CONFIG,
} from "@/lib/colorStatusConfig";
import { PPIC_ROLES, PPIC_STATUSES } from "@/types/ppic";
import type { MemberScanPeriod, PpicRole, PpicStatus } from "@/types/ppic";

const demoStatusCounts: { status: PpicStatus; count: number }[] = [
	{ status: "BARANG_DITERIMA", count: 128 },
	{ status: "SEDANG_DIPACKING", count: 77 },
	{ status: "TERPASANG_DIGUNAKAN", count: 31 },
	{ status: "DALAM_PROSES_RETUR", count: 20 },
];

const demoDays = [
	{ label: "Sab", count: 0 },
	{ label: "Min", count: 0 },
	{ label: "Sen", count: 60 },
	{ label: "Sel", count: 40 },
	{ label: "Rab", count: 70 },
	{ label: "Kam", count: 55 },
	{ label: "Jum", count: 30 },
];

const demoActivities: {
	time: string;
	serial: string;
	project: string;
	status: PpicStatus;
}[] = [
	{
		time: "16.06",
		serial: "P-7387",
		project: "Plafon Fiordini",
		status: "TERPASANG_DIGUNAKAN",
	},
	{
		time: "15.21",
		serial: "P-9774",
		project: "Plafon Fiordini",
		status: "BARANG_DITERIMA",
	},
	{
		time: "14.39",
		serial: "P-8793",
		project: "Plafon Fiordini",
		status: "DALAM_PROSES_RETUR",
	},
	{
		time: "14.21",
		serial: "P-8099",
		project: "Skyhouse B1-27D",
		status: "DALAM_PROSES_RETUR",
	},
];

const demoActivityGroups = [
	{ day: "Hari ini", activities: demoActivities },
	{
		day: "Kemarin",
		activities: demoActivities.slice(0, 3).map((activity, index) => ({
			...activity,
			time: ["17.20", "16.41", "16.12"][index],
			serial: ["P-7032", "P-9700", "P-7948"][index],
		})),
	},
	{
		day: "20 Nov",
		activities: demoActivities.slice(1, 3).map((activity, index) => ({
			...activity,
			time: ["15.05", "13.42"][index],
			serial: ["P-6401", "P-6308"][index],
		})),
	},
];

const roleLabels: Record<PpicRole, string> = {
	MEMBER: "Member",
	ADMIN: "Admin",
	SUPER_ADMIN: "Super Admin",
};

function ActivityList({ activities }: { activities: typeof demoActivities }) {
	return (
		<ul className="divide-y divide-border/70">
			{activities.map((activity) => (
				<li
					key={`${activity.serial}-${activity.time}`}
					className="flex min-h-17 items-center gap-3 px-4 py-2.5"
				>
					<time className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
						{activity.time}
					</time>
					<div className="min-w-0 flex-1">
						<p className="font-semibold">{activity.serial}</p>
						<p className="truncate text-xs text-muted-foreground">
							{activity.project}
						</p>
					</div>
					<Badge
						variant="outline"
						className={`${STATUS_BADGE_CLASS_NAME} h-auto shrink-0 rounded-lg px-3 py-1 text-xs`}
						style={
							{
								"--status-color": STATUS_COLOR_CONFIG[activity.status].color,
								"--status-text-color":
									STATUS_COLOR_CONFIG[activity.status].textColor,
							} as CSSProperties
						}
					>
						{STATUS_COLOR_CONFIG[activity.status].shortLabel}
					</Badge>
				</li>
			))}
		</ul>
	);
}

export function UserDetailPage({ memberId }: { memberId: string }) {
	const [activeTab, setActiveTab] = useState<string | null>("summary");
	const [period, setPeriod] = useState<MemberScanPeriod>("7");
	const [role, setRole] = useState<PpicRole>("ADMIN");
	const [draftRole, setDraftRole] = useState<PpicRole>("ADMIN");
	const [savedStatuses, setSavedStatuses] = useState<PpicStatus[]>([
		...PPIC_STATUSES,
	]);
	const [draftStatuses, setDraftStatuses] = useState<PpicStatus[]>([
		...PPIC_STATUSES,
	]);
	const [savedDrafterAccess, setSavedDrafterAccess] = useState(false);
	const [draftDrafterAccess, setDraftDrafterAccess] = useState(false);
	const [notice, setNotice] = useState("");

	const resetAccess = () => {
		setDraftRole(role);
		setDraftStatuses(savedStatuses);
		setDraftDrafterAccess(savedDrafterAccess);
		setNotice("");
	};

	return (
		<main className="mx-auto min-h-dvh max-w-120 bg-background pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
			<Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
				<PageHeader
					eyebrow="Pengguna"
					title="Nama Pengguna"
					backHref="/admin/users"
				>
					<TabsList
						aria-label="Detail pengguna"
						className="mt-3 grid h-11 w-full grid-cols-3 rounded-xl bg-muted p-1"
					>
						<TabsTrigger
							value="summary"
							className="rounded-lg font-semibold data-active:bg-accent data-active:text-white"
						>
							Ringkasan
						</TabsTrigger>
						<TabsTrigger
							value="activity"
							className="rounded-lg font-semibold data-active:bg-accent data-active:text-white"
						>
							Aktivitas
						</TabsTrigger>
						<TabsTrigger
							value="access"
							className="rounded-lg font-semibold data-active:bg-accent data-active:text-white"
						>
							Akses
						</TabsTrigger>
					</TabsList>
				</PageHeader>

				<div className="mx-4 mt-4 flex items-center gap-3">
					<div className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-muted text-sm font-bold">
						NP
					</div>
					<div className="min-w-0 flex-1">
						<p className="font-semibold">Admin · Aktif</p>
						<p className="text-xs text-muted-foreground">
							Scan terakhir 20 Nov, 11.12 WIB
						</p>
					</div>
					<Badge
						variant="outline"
						className="shrink-0 rounded-full text-[10px]"
					>
						Data contoh
					</Badge>
				</div>

				<TabsContent value="summary" className="mt-4 space-y-3 px-4">
					<Link
						href={`/admin/users/${encodeURIComponent(memberId)}/scan-overview`}
						className="flex min-h-11 items-center justify-center rounded-full border border-border/70 bg-card px-4 text-sm font-medium"
					>
						Lihat ringkasan scan sebelumnya
					</Link>
					<div className="flex gap-2" aria-label="Periode ringkasan">
						{(
							[
								["7", "7 hari"],
								["30", "30 hari"],
								["month", "Bulan ini"],
							] as const
						).map(([value, label]) => (
							<Button
								key={value}
								type="button"
								size="sm"
								variant={period === value ? "default" : "outline"}
								className="min-h-10 rounded-full"
								aria-pressed={period === value}
								onClick={() => setPeriod(value)}
							>
								{label}
							</Button>
						))}
					</div>

					<div className="grid grid-cols-2 gap-3">
						<SummaryCard
							label="Total scan"
							value={period === "7" ? "255" : period === "30" ? "842" : "1.240"}
							footnote="+39% vs periode lalu"
						/>
						<SummaryCard label="Hari ini" value="30" footnote="Sementara" />
						<SummaryCard
							label="Rata-rata"
							value="36"
							footnote="scan per hari"
						/>
						<SummaryCard
							label="Jam tersibuk"
							value="10.00–12.00"
							footnote="paling banyak scan"
							compact
						/>
					</div>

					<section className="rounded-3xl border border-border/70 bg-card p-4">
						<div className="mb-4 flex items-center justify-between gap-2">
							<h2 className="font-bold">Scan per hari</h2>
							<p className="text-xs text-muted-foreground">Puncak Rab, 70</p>
						</div>
						<div className="flex h-36 gap-2">
							{demoDays.map((day) => (
								<div
									key={day.label}
									className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
								>
									<span className="text-[10px] tabular-nums text-muted-foreground">
										{day.count}
									</span>
									<div
										className={`w-full max-w-9 rounded-t-md ${day.label === "Rab" ? "bg-accent" : "bg-muted"}`}
										style={{
											height: `${Math.max(2, (day.count / 70) * 96)}px`,
										}}
									/>
									<span className="text-[10px] text-muted-foreground">
										{day.label}
									</span>
								</div>
							))}
						</div>
					</section>

					<section className="rounded-3xl border border-border/70 bg-card p-4">
						<h2 className="mb-4 font-bold">Scan per status</h2>
						<div
							className="mb-4 flex h-3 overflow-hidden rounded-full"
							aria-label="Grafik scan per status, data contoh"
						>
							{demoStatusCounts.map(({ status, count }) => (
								<span
									key={status}
									style={{
										width: `${(count / 256) * 100}%`,
										backgroundColor: STATUS_COLOR_CONFIG[status].color,
									}}
								/>
							))}
						</div>
						<ul className="space-y-3">
							{demoStatusCounts.map(({ status, count }) => (
								<li key={status} className="flex items-center gap-2 text-sm">
									<span
										aria-hidden="true"
										className="size-2.5 rounded-full"
										style={{
											backgroundColor: STATUS_COLOR_CONFIG[status].color,
										}}
									/>
									<span className="flex-1">
										{STATUS_COLOR_CONFIG[status].shortLabel}
									</span>
									<span className="tabular-nums">
										{count} · {Math.round((count / 256) * 100)}%
									</span>
								</li>
							))}
						</ul>
					</section>

					<div className="flex items-center justify-between gap-2">
						<h2 className="font-bold">Aktivitas terbaru</h2>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={() => setActiveTab("activity")}
						>
							Lihat semua
						</Button>
					</div>
					<section className="overflow-hidden rounded-3xl border border-border/70 bg-card">
						<ActivityList activities={demoActivities} />
					</section>
					<p className="pb-2 text-center text-[11px] text-muted-foreground">
						Pratinjau UI — seluruh angka dan aktivitas adalah data contoh.
					</p>
				</TabsContent>

				<TabsContent value="activity" className="mt-4 space-y-4 px-4">
					{demoActivityGroups.map(({ day, activities }, index) => (
						<section
							key={day}
							className="space-y-2"
							aria-labelledby={`activity-day-${index}`}
						>
							<h2
								id={`activity-day-${index}`}
								className="px-1 text-xs font-medium text-muted-foreground"
							>
								{day}
							</h2>
							<div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
								<ActivityList activities={activities} />
							</div>
						</section>
					))}
					<p className="text-center text-[11px] text-muted-foreground">
						Pratinjau UI — aktivitas di atas hanya contoh.
					</p>
				</TabsContent>

				<TabsContent value="access" className="mt-4 space-y-3 px-4">
					<section className="rounded-3xl border border-border/70 bg-card p-4">
						<p className="mb-2 text-sm text-muted-foreground">Peran</p>
						<div className="flex rounded-2xl bg-muted p-1">
							{PPIC_ROLES.map((option) => (
								<Button
									key={option}
									type="button"
									variant={draftRole === option ? "outline" : "ghost"}
									className={`min-h-11 flex-1 rounded-xl px-2 text-xs ${draftRole === option ? "bg-card" : "bg-transparent"}`}
									onClick={() => setDraftRole(option)}
								>
									{roleLabels[option]}
								</Button>
							))}
						</div>

						<div className="mt-4 border-b pb-3">
							<label className="flex min-h-10 items-center gap-3">
								<span className="flex-1 font-medium">Drafter</span>
								<Checkbox
									checked={draftRole === "ADMIN" || draftDrafterAccess}
									disabled={draftRole === "ADMIN"}
									aria-label="Akses Drafter"
									className="h-7 w-12 justify-start rounded-full border-input bg-muted p-1 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform data-checked:border-input data-checked:bg-accent data-checked:before:translate-x-5 **:data-[slot=checkbox-indicator]:hidden"
									onCheckedChange={(checked) =>
										setDraftDrafterAccess(checked === true)
									}
								/>
							</label>
							<p className="text-xs leading-5 text-muted-foreground">
								Import, preview, dan aktifkan model. Akses scan diatur terpisah.
							</p>
						</div>

						<div className="divide-y divide-border/70">
							{PPIC_STATUSES.map((status) => (
								<AccessStatusRow
									key={status}
									status={status}
									checked={
										draftStatuses.includes(status) ||
										draftRole === "ADMIN" ||
										draftRole === "SUPER_ADMIN"
									}
									disabled={
										draftRole === "ADMIN" || draftRole === "SUPER_ADMIN"
									}
									onCheckedChange={(checked) =>
										setDraftStatuses((current) =>
											checked
												? [...current, status]
												: current.filter((value) => value !== status),
										)
									}
								/>
							))}
						</div>
					</section>

					{notice && (
						<p
							role="status"
							className="text-center text-xs text-muted-foreground"
						>
							{notice}
						</p>
					)}
					<p className="text-center text-[11px] text-muted-foreground">
						Pratinjau UI — perubahan akses tidak disimpan.
					</p>
					<div className="grid grid-cols-2 gap-3">
						<Button
							type="button"
							variant="outline"
							className="min-h-12 rounded-2xl bg-card"
							onClick={resetAccess}
						>
							Batal
						</Button>
						<Button
							type="button"
							className="min-h-12 rounded-2xl"
							onClick={() => {
								setRole(draftRole);
								setSavedStatuses(draftStatuses);
								setSavedDrafterAccess(draftDrafterAccess);
								setNotice("Perubahan hanya berlaku selama pratinjau ini.");
							}}
						>
							Simpan
						</Button>
					</div>
				</TabsContent>
			</Tabs>
		</main>
	);
}

function SummaryCard({
	label,
	value,
	footnote,
	compact = false,
}: {
	label: string;
	value: string;
	footnote: string;
	compact?: boolean;
}) {
	return (
		<section className="flex min-h-27 flex-col rounded-3xl border border-border/70 bg-card p-3.5">
			<h2 className="text-xs text-muted-foreground">{label}</h2>
			<p
				className={`mt-1 font-bold leading-tight tabular-nums ${compact ? "text-lg" : "text-[28px]"}`}
			>
				{value}
			</p>
			<p className="mt-auto pt-1 text-xs text-muted-foreground">{footnote}</p>
		</section>
	);
}

function AccessStatusRow({
	status,
	checked,
	disabled,
	onCheckedChange,
}: {
	status: PpicStatus;
	checked: boolean;
	disabled: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex min-h-14 items-center gap-3 py-2">
			<span
				aria-hidden="true"
				className="size-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: STATUS_COLOR_CONFIG[status].color }}
			/>
			<span className="flex-1 font-medium">
				{STATUS_COLOR_CONFIG[status].shortLabel}
			</span>
			<Checkbox
				checked={checked}
				disabled={disabled}
				aria-label={`Akses ${STATUS_COLOR_CONFIG[status].shortLabel}`}
				className="h-7 w-12 justify-start rounded-full border-input bg-muted p-1 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform data-checked:border-input data-checked:bg-accent data-checked:before:translate-x-5 **:data-[slot=checkbox-indicator]:hidden"
				onCheckedChange={(value) => onCheckedChange(value === true)}
			/>
		</label>
	);
}
