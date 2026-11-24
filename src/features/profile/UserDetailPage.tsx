"use client";

import { useState } from "react";
import { InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/pageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberScanOverview } from "@/features/settings/MemberScanOverview";
import { usePanelMembers } from "@/hooks/use-panel-members";
import {
	STATUS_BADGE_CLASS_NAME,
	STATUS_COLOR_CONFIG,
} from "@/lib/colorStatusConfig";
import { hasPpicAdminAccess, PPIC_ROLES, PPIC_STATUSES } from "@/types/ppic";
import type { PpicRole, PpicScanHistory, PpicStatus } from "@/types/ppic";
import type { CSSProperties } from "react";

const roleLabels: Record<PpicRole, string> = {
	MEMBER: "Member",
	ADMIN: "Admin",
	SUPER_ADMIN: "Super Admin",
};

export function UserDetailPage({
	memberId,
	canManageAdmin,
	history,
	hasMoreHistory,
}: {
	memberId: string;
	canManageAdmin: boolean;
	history: PpicScanHistory[] | null;
	hasMoreHistory: boolean;
}) {
	const {
		members,
		roles,
		permissions,
		lbyImporters,
		provisioned,
		loading,
		error,
		refreshError,
		updateRole,
		updatePermission,
		updateLbyPermission,
		savingMemberId,
	} = usePanelMembers();
	const [activeTab, setActiveTab] = useState<string | null>("summary");
	const [activity, setActivity] = useState(history);
	const [hasMoreActivity, setHasMoreActivity] = useState(hasMoreHistory);
	const [loadingActivity, setLoadingActivity] = useState(false);
	const [activityLoadError, setActivityLoadError] = useState(false);
	const member = members?.find((item) => item.id === memberId);
	const role = roles[memberId] ?? "MEMBER";
	const statuses = permissions[memberId] ?? [];
	const drafter = lbyImporters[memberId] ?? false;

	return (
		<main className="mx-auto min-h-dvh max-w-120 bg-background pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
			<Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
				<PageHeader
					eyebrow={member ? roleLabels[role] : "Pengguna"}
					title={member?.name ?? "Detail pengguna"}
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
				{loading ? (
					<p role="status" className="p-4">
						Memuat pengguna...
					</p>
				) : error ? (
					<p role="alert" className="p-4">
						Gagal memuat pengguna.
					</p>
				) : !member ? (
					<p className="p-4">Pengguna tidak ditemukan.</p>
				) : (
					<>
						{refreshError && (
							<p role="alert" className="px-4 pt-3 text-sm text-destructive">
								Daftar ClickUp gagal diperbarui. Data lama ditampilkan.
							</p>
						)}
						<TabsContent value="summary">
							<MemberScanOverview memberId={memberId} />
							<div className="flex items-center justify-between px-4">
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
							<div className="mx-4 mt-3">
								<ActivityList
									history={activity?.slice(0, 4) ?? null}
									illustration="folder"
								/>
							</div>
						</TabsContent>
						<TabsContent value="activity" className="mt-4 px-4">
							<ActivityList history={activity} illustration="trackerprod" />
							{hasMoreActivity && (
								<div className="mt-4 space-y-2">
									{activityLoadError && (
										<p role="alert" className="text-sm text-destructive">
											Gagal memuat aktivitas. Coba lagi.
										</p>
									)}
									<Button
										type="button"
										variant="outline"
										className="rounded-full"
										disabled={loadingActivity}
										onClick={async () => {
											setLoadingActivity(true);
											setActivityLoadError(false);
											try {
												const response = await fetch(
													`/api/admin/users/scan-history?user_id=${encodeURIComponent(memberId)}&offset=${activity?.length ?? 0}`,
													{ cache: "no-store" },
												);
												if (!response.ok)
													throw new Error("HISTORY_LOAD_FAILED");
												const page = (await response.json()) as {
													history: PpicScanHistory[];
													hasMore: boolean;
												};
												setActivity((current) =>
													current
														? [...current, ...page.history]
														: page.history,
												);
												setHasMoreActivity(page.hasMore);
											} catch {
												setActivityLoadError(true);
											} finally {
												setLoadingActivity(false);
											}
										}}
									>
										{loadingActivity ? "Memuat..." : "Muat lagi"}
									</Button>
								</div>
							)}
						</TabsContent>
						<TabsContent value="access" className="mt-4 px-4">
							<AccessEditor
								key={memberId}
								memberId={memberId}
								role={role}
								statuses={statuses}
								drafter={drafter}
								provisioned={provisioned[memberId] ?? false}
								canManageAdmin={canManageAdmin}
								saving={Boolean(savingMemberId)}
								updateRole={updateRole}
								updatePermission={updatePermission}
								updateLbyPermission={updateLbyPermission}
							/>
						</TabsContent>
					</>
				)}
			</Tabs>
		</main>
	);
}

function ActivityList({
	history,
	illustration,
}: {
	history: PpicScanHistory[] | null;
	illustration?: "folder" | "trackerprod";
}) {
	if (!history)
		return (
			<p role="alert" className="text-sm text-destructive">
				Gagal memuat aktivitas scan.
			</p>
		);
	if (!history.length && illustration === "folder")
		return (
			<div className="flex min-h-[32dvh] flex-col items-center justify-center gap-3 text-center">
				<div
					aria-hidden="true"
					className="size-40 bg-[color-mix(in_srgb,var(--accent)_30%,var(--background))]"
					style={{
						maskImage: "url('/empty-folder.svg')",
						maskPosition: "center",
						maskRepeat: "no-repeat",
						maskSize: "contain",
						WebkitMaskImage: "url('/empty-folder.svg')",
						WebkitMaskPosition: "center",
						WebkitMaskRepeat: "no-repeat",
						WebkitMaskSize: "contain",
					}}
				/>
				<p className="text-sm text-muted-foreground">
					Belum ada aktivitas scan.
				</p>
			</div>
		);
	if (!history.length && illustration === "trackerprod")
		return (
			<div className="flex min-h-[48dvh] flex-col items-center justify-center gap-3 text-center">
				<div
					aria-hidden="true"
					className="size-44 bg-[color-mix(in_srgb,var(--accent)_30%,var(--background))]"
					style={{
						maskImage: "url('/empty-trackerprod.svg')",
						maskPosition: "center",
						maskRepeat: "no-repeat",
						maskSize: "contain",
						WebkitMaskImage: "url('/empty-trackerprod.svg')",
						WebkitMaskPosition: "center",
						WebkitMaskRepeat: "no-repeat",
						WebkitMaskSize: "contain",
					}}
				/>
				<p className="text-sm text-muted-foreground">
					Belum ada aktivitas scan.
				</p>
			</div>
		);
	if (!history.length)
		return (
			<p className="text-sm text-muted-foreground">Belum ada aktivitas scan.</p>
		);
	const groups = new Map<string, PpicScanHistory[]>();
	const dateFormatter = new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone: "Asia/Jakarta",
	});
	for (const item of history) {
		const date = new Date(`${item.scannedAt.replace(" ", "T")}Z`);
		const key = Number.isNaN(date.getTime())
			? "unknown"
			: dateFormatter.format(date);
		const entries = groups.get(key) ?? [];
		entries.push(item);
		groups.set(key, entries);
	}
	return (
		<div className="space-y-4">
			{Array.from(groups, ([day, entries]) => (
				<section key={day} className="space-y-2">
					<h3 className="px-1 text-xs font-medium text-muted-foreground">
						{day === "unknown"
							? "Tanggal tidak diketahui"
							: new Intl.DateTimeFormat("id-ID", {
									day: "numeric",
									month: "short",
									year:
										Number(day.slice(0, 4)) === new Date().getFullYear()
											? undefined
											: "numeric",
									timeZone: "Asia/Jakarta",
								}).format(new Date(`${day}T12:00:00+07:00`))}
					</h3>
					<ul className="divide-y divide-border/70 overflow-hidden rounded-3xl border border-border/70 bg-card">
						{entries.map((item, index) => {
							const config =
								STATUS_COLOR_CONFIG[item.status] ?? STATUS_COLOR_CONFIG.OTHER;
							const date = new Date(`${item.scannedAt.replace(" ", "T")}Z`);
							return (
								<li
									key={`${item.scannedAt}-${index}`}
									className="flex min-h-17 items-center gap-3 px-4 py-2.5"
								>
									<time className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
										{Number.isNaN(date.getTime())
											? "?"
											: new Intl.DateTimeFormat("id-ID", {
													hour: "2-digit",
													minute: "2-digit",
													hourCycle: "h23",
													timeZone: "Asia/Jakarta",
												}).format(date)}
									</time>
									<div className="min-w-0 flex-1">
										<p className="font-semibold">{item.serialNumber}</p>
										<p className="truncate text-xs text-muted-foreground">
											{item.taskName}
										</p>
									</div>
									<Badge
										variant="outline"
										className={`${STATUS_BADGE_CLASS_NAME} h-auto shrink-0 rounded-lg px-3 py-1 text-xs`}
										style={
											{
												"--status-color": config.color,
												"--status-text-color": config.textColor,
											} as CSSProperties
										}
									>
										{config.shortLabel}
									</Badge>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}

function AccessEditor({
	memberId,
	role,
	statuses,
	drafter,
	provisioned,
	canManageAdmin,
	saving,
	updateRole,
	updatePermission,
	updateLbyPermission,
}: {
	memberId: string;
	role: PpicRole;
	statuses: PpicStatus[];
	drafter: boolean;
	provisioned: boolean;
	canManageAdmin: boolean;
	saving: boolean;
	updateRole: (id: string, role: PpicRole) => Promise<unknown>;
	updatePermission: (
		id: string,
		statuses: PpicStatus[] | null,
	) => Promise<unknown>;
	updateLbyPermission: (id: string, enabled: boolean) => Promise<unknown>;
}) {
	const [draftRole, setDraftRole] = useState(role);
	const [draftStatuses, setDraftStatuses] = useState(statuses);
	const [draftDrafter, setDraftDrafter] = useState(drafter);
	const [saveError, setSaveError] = useState("");
	const locked = role === "ADMIN" && !canManageAdmin;
	const reset = () => {
		setDraftRole(role);
		setDraftStatuses(statuses);
		setDraftDrafter(drafter);
		setSaveError("");
	};
	const save = async () => {
		setSaveError("");
		try {
			const roleChanged = role !== draftRole;
			if (roleChanged) await updateRole(memberId, draftRole);
			if (
				draftRole === "MEMBER" &&
				(roleChanged ||
					draftStatuses.length !== statuses.length ||
					draftStatuses.some((status) => !statuses.includes(status)))
			)
				await updatePermission(
					memberId,
					draftStatuses.length ? draftStatuses : null,
				);
			if (draftRole !== "ADMIN" && drafter !== draftDrafter)
				await updateLbyPermission(memberId, draftDrafter);
			toast.success("Akses berhasil diperbarui.");
		} catch (error) {
			const message =
				error instanceof Error && error.message === "USER_NOT_PROVISIONED"
					? "Akun Scanner pengguna belum terhubung ke ClickUp. Minta pengguna login dulu; jika sudah login, periksa pemetaan akunnya."
					: "Gagal memperbarui akses. Sebagian perubahan mungkin sudah tersimpan; periksa dan coba lagi.";
			setSaveError(message);
			toast.error(message);
		}
	};
	return (
		<section className="space-y-3">
			{!provisioned && (
				<Alert variant="destructive">
					<InfoIcon className="size-4" />
					<AlertDescription>
						Akun Scanner pengguna belum terhubung ke ClickUp. Minta pengguna login
						dulu; jika sudah login, periksa pemetaan akunnya.
					</AlertDescription>
				</Alert>
			)}
			<div className="rounded-3xl border border-border/70 bg-card p-4">
				<p className="mb-2 text-sm text-muted-foreground">Peran</p>
				<div className="flex rounded-2xl bg-muted p-1">
					{PPIC_ROLES.filter(
						(option) =>
							option !== "ADMIN" || canManageAdmin || role === "ADMIN",
					).map((option) => (
						<Button
							key={option}
							type="button"
							disabled={locked || saving}
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
							checked={draftRole === "ADMIN" || draftDrafter}
							disabled={locked || saving || draftRole === "ADMIN"}
							aria-label="Akses Drafter"
							className="h-7 w-12 justify-start rounded-full border-input bg-muted p-1 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform data-checked:border-input data-checked:bg-accent data-checked:before:translate-x-5 **:data-[slot=checkbox-indicator]:hidden"
							onCheckedChange={(checked) => setDraftDrafter(checked === true)}
						/>
					</label>
					<p className="text-xs leading-5 text-muted-foreground">
						Import, preview, dan aktifkan model. Akses scan diatur terpisah.
					</p>
				</div>
				<div className="divide-y divide-border/70">
					{PPIC_STATUSES.map((status) => (
						<label
							key={status}
							className="flex min-h-14 items-center gap-3 py-2"
						>
							<span
								aria-hidden="true"
								className="size-2.5 rounded-full"
								style={{ backgroundColor: STATUS_COLOR_CONFIG[status].color }}
							/>
							<span className="flex-1 font-medium">
								{STATUS_COLOR_CONFIG[status].shortLabel}
							</span>
							<Checkbox
								checked={
									hasPpicAdminAccess(draftRole) ||
									draftStatuses.includes(status)
								}
								disabled={locked || saving || hasPpicAdminAccess(draftRole)}
								aria-label={`Akses ${STATUS_COLOR_CONFIG[status].shortLabel}`}
								className="h-7 w-12 justify-start rounded-full border-input bg-muted p-1 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform data-checked:border-input data-checked:bg-accent data-checked:before:translate-x-5 **:data-[slot=checkbox-indicator]:hidden"
								onCheckedChange={(checked) =>
									setDraftStatuses((current) =>
										checked === true
											? [...current, status]
											: current.filter((value) => value !== status),
									)
								}
							/>
						</label>
					))}
				</div>
			</div>
			{locked && (
				<p className="text-sm text-muted-foreground">
					Hanya Admin yang dapat mengubah akses Admin.
				</p>
			)}
			{saveError && (
				<Alert variant="destructive">
					<InfoIcon className="size-4" />
					<AlertDescription>{saveError}</AlertDescription>
				</Alert>
			)}
			<div className="grid grid-cols-2 gap-3">
				<Button
					type="button"
					variant="outline"
					disabled={locked || saving}
					className="min-h-12 rounded-2xl bg-card"
					onClick={reset}
				>
					Batal
				</Button>
				<Button
					type="button"
					disabled={locked || saving}
					className="min-h-12 rounded-2xl"
					onClick={() => void save()}
				>
					{saving ? "Menyimpan..." : "Simpan"}
				</Button>
			</div>
		</section>
	);
}
