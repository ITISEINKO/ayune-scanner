"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/pageHeader";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberScanOverview } from "./MemberScanOverview";
import { usePanelMembers } from "@/hooks/use-panel-members";
import { hasPpicAdminAccess, PPIC_ROLES, PPIC_STATUSES } from "@/types/ppic";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import type { PanelMember } from "@/types/clickup";
import type { PpicRole, PpicStatus, PpicStatuses } from "@/types/ppic";

const statusOptions = PPIC_STATUSES.map((status) => ({
	status,
	...STATUS_COLOR_CONFIG[status],
}));

export const SettingPage = ({
	canManageAdmin = false,
}: {
	canManageAdmin?: boolean;
}) => {
	const {
		members,
		roles,
		permissions,
		lbyImporters,
		loading,
		error,
		refreshError,
		updateRole,
		updatePermission,
		updateLbyPermission,
		savingMemberId,
	} = usePanelMembers();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		PpicStatus | "inactive" | null
	>(null);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
	const [draftRole, setDraftRole] = useState<PpicRole>("MEMBER");
	const [draftStatuses, setDraftStatuses] = useState<PpicStatuses>([]);
	const [draftLbyImport, setDraftLbyImport] = useState(false);
	const [saveError, setSaveError] = useState(false);

	useEffect(() => {
		const timeout = window.setTimeout(
			() => setDebouncedSearch(search.trim().toLowerCase()),
			250,
		);
		return () => window.clearTimeout(timeout);
	}, [search]);

	const filteredMembers =
		members?.filter((member) => {
			if (!member.name.toLowerCase().includes(debouncedSearch)) return false;
			const inactive =
				!hasPpicAdminAccess(roles[member.id]) &&
				!permissions[member.id]?.length &&
				!lbyImporters[member.id];
			return statusFilter === "inactive"
				? inactive
				: !statusFilter ||
						hasPpicAdminAccess(roles[member.id]) ||
						!!permissions[member.id]?.includes(statusFilter);
		}) ?? [];
	const editingMember = members?.find(
		(member) => member.id === editingMemberId,
	);

	const openEditor = (member: PanelMember) => {
		setDraftRole(roles[member.id] ?? "MEMBER");
		setDraftStatuses(permissions[member.id] ?? []);
		setDraftLbyImport(lbyImporters[member.id] ?? false);
		setEditingMemberId(member.id);
	};

	const saveAccess = async () => {
		if (!editingMember) return;
		setSaveError(false);
		try {
			const roleChanged = (roles[editingMember.id] ?? "MEMBER") !== draftRole;
			if (roleChanged) await updateRole(editingMember.id, draftRole);
			if (draftRole === "MEMBER") {
				const savedStatuses = permissions[editingMember.id] ?? [];
				if (
					roleChanged ||
					draftStatuses.length !== savedStatuses.length ||
					draftStatuses.some((status) => !savedStatuses.includes(status))
				)
					await updatePermission(
						editingMember.id,
						draftStatuses.length ? draftStatuses : null,
					);
			}
			if (
				draftRole !== "ADMIN" &&
				(lbyImporters[editingMember.id] ?? false) !== draftLbyImport
			)
				await updateLbyPermission(editingMember.id, draftLbyImport);
			toast.success("Akses berhasil diperbarui.");
			setEditingMemberId(null);
		} catch {
			setSaveError(true);
			toast.error("Gagal memperbarui akses.");
		}
	};

	if (error)
		return (
			<main className="flex min-h-dvh items-center justify-center bg-muted p-6 pb-28">
				<section className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
					<img
						src="/401.webp"
						alt=""
						className="mx-auto mb-4 w-full max-w-xs"
					/>
					<h1 className="text-xl font-bold">Access denied</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						You don&apos;t have access to this panel.
					</p>
				</section>
			</main>
		);

	return (
		<main className="mx-auto min-h-dvh max-w-120 bg-background pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
			<PageHeader eyebrow="Settings" title="Pengguna & aktivitas" backHref="/admin/settings" />
			<section className="px-4 pt-4" aria-label="Pengguna dan aktivitas">
				<p className="mb-5 text-sm text-muted-foreground">
					Ringkasan aktivitas scan dan akses pengguna.
				</p>
				<Input
					aria-label="Cari nama"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Cari nama"
					className="h-12 rounded-[14px] bg-card px-3.5 text-sm"
				/>
				<div
					className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1"
					aria-label="Filter akses"
				>
					<Button
						type="button"
						size="sm"
						variant={statusFilter === null ? "default" : "outline"}
						className="min-h-10 shrink-0 rounded-full"
						onClick={() => setStatusFilter(null)}
						aria-pressed={statusFilter === null}
					>
						Semua
					</Button>
					{statusOptions.map((option) => (
						<Button
							key={option.status}
							type="button"
							size="sm"
							variant={statusFilter === option.status ? "default" : "outline"}
							className="min-h-10 shrink-0 rounded-full"
							onClick={() => setStatusFilter(option.status)}
							aria-pressed={statusFilter === option.status}
						>
							{option.shortLabel}
						</Button>
					))}
					<Button
						type="button"
						size="sm"
						variant={statusFilter === "inactive" ? "default" : "outline"}
						className="min-h-10 shrink-0 rounded-full"
						onClick={() => setStatusFilter("inactive")}
						aria-pressed={statusFilter === "inactive"}
					>
						Nonaktif
					</Button>
				</div>
				{refreshError && (
					<p role="alert" className="mt-3 text-sm text-destructive">
						Daftar ClickUp gagal diperbarui. Data lama ditampilkan; muat ulang
						halaman untuk mencoba lagi.
					</p>
				)}
				{saveError && (
					<p role="alert" className="mt-3 text-sm text-destructive">
						Could not save access. Try again.
					</p>
				)}
				{loading || !members ? (
					<div
						role="status"
						aria-label="Loading members"
						className="mt-4 space-y-2"
					>
						{Array.from({ length: 5 }, (_, index) => (
							<Skeleton key={index} className="h-17 rounded-[20px]" />
						))}
					</div>
				) : filteredMembers.length ? (
					<div className="mt-4 divide-y overflow-hidden rounded-[20px] border bg-card">
						{filteredMembers.map((member) => {
							const role = roles[member.id] ?? "MEMBER";
							const selectedStatuses = permissions[member.id] ?? [];
							const initials = member.name
								.trim()
								.split(/\s+/)
								.slice(0, 2)
								.map((part) => part[0])
								.join("")
								.toUpperCase();
							const roleLabel =
								role === "ADMIN"
									? "Admin"
									: role === "SUPER_ADMIN"
										? "Super Admin"
										: "Member";
							return (
								<button
									key={member.id}
									type="button"
									className="flex min-h-17 w-full items-center gap-3 px-3.5 py-2.75 text-left hover:bg-muted focus-visible:relative focus-visible:outline-2 focus-visible:outline-primary"
									aria-label={`Lihat detail ${member.name}`}
									aria-haspopup="dialog"
									disabled={
										savingMemberId === member.id ||
										(role === "ADMIN" && !canManageAdmin)
									}
									onClick={() => openEditor(member)}
								>
									<span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-muted text-[13px] font-bold">
										{initials}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold">
											{member.name}
										</span>
										<span className="block truncate text-xs text-muted-foreground">
											{roleLabel}
											{role !== "ADMIN" && lbyImporters[member.id]
												? " · Drafter"
												: ""}
											{role === "MEMBER" &&
											!selectedStatuses.length &&
											!lbyImporters[member.id]
												? " · Nonaktif"
												: ""}
										</span>
									</span>
									<span
										className="flex shrink-0 gap-1"
										aria-label={`Akses: ${
											statusOptions
												.filter(
													(option) =>
														hasPpicAdminAccess(role) ||
														selectedStatuses.includes(option.status),
												)
												.map((option) => option.shortLabel)
												.join(", ") || "tidak ada"
										}`}
									>
										{statusOptions.map((option) => (
											<span
												key={option.status}
												aria-hidden="true"
												className="size-2 rounded-full bg-border"
												style={
													hasPpicAdminAccess(role) ||
													selectedStatuses.includes(option.status)
														? { backgroundColor: option.color }
														: undefined
												}
											/>
										))}
									</span>
								</button>
							);
						})}
					</div>
				) : (
					<p className="mt-4 text-sm text-muted-foreground">
						Tidak ada pengguna yang cocok dengan filter.
					</p>
				)}
				<details className="mt-3 text-xs text-muted-foreground">
					<summary className="flex min-h-10 w-fit cursor-pointer items-center gap-1.5">
						<Info aria-hidden="true" size={15} /> Info akses ClickUp
					</summary>
					<p>
						Daftar pengguna diperbarui dari channel ClickUp saat halaman dibuka.
						Pastikan pengguna memiliki akses ke channel tersebut.
					</p>
				</details>
			</section>
			<Drawer
				open={Boolean(editingMember)}
				onOpenChange={(open) => !open && setEditingMemberId(null)}
				showSwipeHandle
			>
				<DrawerContent className="[--drawer-inset:0px]! mx-auto max-w-lg rounded-t-3xl border-t bg-background">
					{editingMember && (
						<>
							<DrawerHeader className="items-start px-6 pt-5 text-left">
								<div className="flex items-center gap-3">
									<div className="flex size-11 items-center justify-center rounded-full bg-muted font-medium">
										{editingMember.name
											.split(/\s+/)
											.slice(0, 2)
											.map((part) => part[0])
											.join("")
											.toUpperCase()}
									</div>
									<div>
										<DrawerTitle className="font-bold">
											{editingMember.name}
										</DrawerTitle>
										<DrawerDescription>
											{roles[editingMember.id] === "ADMIN"
												? "Admin"
												: roles[editingMember.id] === "SUPER_ADMIN"
													? "Super Admin"
													: "Member"}
											{` · ${hasPpicAdminAccess(roles[editingMember.id]) || permissions[editingMember.id]?.length || lbyImporters[editingMember.id] ? "Aktif" : "Nonaktif"}`}
										</DrawerDescription>
									</div>
								</div>
								<Link
									href={`/admin/users/${encodeURIComponent(editingMember.id)}`}
									className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
								>
									Lihat detail lengkap
								</Link>
							</DrawerHeader>

							<Tabs
								key={editingMember.id}
								defaultValue="overview"
								className="mt-4 min-h-0 gap-0"
							>
								<TabsList className="mx-6 mb-1 w-auto shrink-0 rounded-xl">
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="access">Akses halaman</TabsTrigger>
								</TabsList>
								<TabsContent
									value="overview"
									className="min-h-0 overflow-y-auto"
								>
									<MemberScanOverview memberId={editingMember.id} />
								</TabsContent>
								<TabsContent
									value="access"
									className="flex min-h-0 flex-col overflow-hidden"
								>
									<div className="overflow-y-auto px-6 py-5">
										<p className="mb-2 text-sm text-muted-foreground">Peran</p>
										<div className="flex rounded-xl bg-muted p-1">
											{PPIC_ROLES.filter(
												(role) => role !== "ADMIN" || canManageAdmin,
											).map((role) => (
												<Button
													key={role}
													type="button"
													variant={draftRole === role ? "outline" : "ghost"}
													className={
														draftRole === role
															? "min-h-10 flex-1 bg-card"
															: "min-h-10 flex-1 bg-transparent"
													}
													onClick={() => setDraftRole(role)}
												>
													{role === "MEMBER"
														? "Member"
														: role === "SUPER_ADMIN"
															? "Super Admin"
															: "Admin"}
												</Button>
											))}
										</div>

										<p className="mt-6 border-b pb-2 text-sm text-muted-foreground">
											Akses halaman
										</p>
										<div className="divide-y">
											<div className="py-3">
												<label className="flex min-h-10 items-center gap-3">
													<span className="flex-1">Drafter</span>
													<Checkbox
														checked={draftRole === "ADMIN" || draftLbyImport}
														disabled={draftRole === "ADMIN"}
														className="h-7 w-12 justify-start rounded-full border-input bg-muted p-1 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform data-checked:bg-accent data-checked:border-input data-checked:before:translate-x-5 **:data-[slot=checkbox-indicator]:hidden"
														onCheckedChange={(checked) =>
															setDraftLbyImport(checked === true)
														}
													/>
												</label>
												<p className="text-xs text-muted-foreground">
													Import, preview, dan aktifkan model. Akses scan diatur
													terpisah.
												</p>
											</div>
											{statusOptions.map((option) => (
												<label
													key={option.status}
													className="flex min-h-16 items-center gap-3 py-3"
												>
													<span
														className="size-2.5 rounded-full"
														style={{ backgroundColor: option.color }}
													/>
													<span className="flex-1">{option.label}</span>
													<Checkbox
														checked={draftStatuses.includes(option.status)}
														disabled={hasPpicAdminAccess(draftRole)}
														className="h-7 w-12 justify-start rounded-full border-input bg-muted p-1 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform data-checked:bg-accent data-checked:border-input data-checked:before:translate-x-5 **:data-[slot=checkbox-indicator]:hidden"
														onCheckedChange={(checked) =>
															setDraftStatuses((current) =>
																checked
																	? [...current, option.status]
																	: current.filter(
																			(status) => status !== option.status,
																		),
															)
														}
													/>
												</label>
											))}
										</div>
									</div>

									<DrawerFooter className="grid grid-cols-2 gap-3 px-6 pb-6">
										<DrawerClose
											render={
												<Button
													type="button"
													variant="outline"
													disabled={Boolean(savingMemberId)}
												/>
											}
										>
											Batal
										</DrawerClose>
										<Button
											type="button"
											disabled={Boolean(savingMemberId)}
											onClick={() => void saveAccess()}
										>
											{savingMemberId ? "Menyimpan..." : "Simpan"}
										</Button>
									</DrawerFooter>
								</TabsContent>
							</Tabs>
						</>
					)}
				</DrawerContent>
			</Drawer>
		</main>
	);
};
