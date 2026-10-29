"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { hasPpicAdminAccess, PPIC_STATUSES, PPIC_ROLES } from "@/types/ppic";
import {
	STATUS_BADGE_CLASS_NAME,
	STATUS_COLOR_CONFIG,
} from "@/lib/colorStatusConfig";
import type { PanelMember } from "@/types/clickup";
import type { PpicRole, PpicStatus, PpicStatuses } from "@/types/ppic";

const statusOptions = PPIC_STATUSES.map((status) => ({
	status,
	...STATUS_COLOR_CONFIG[status],
}));

export const SettingPage = ({ canManageAdmin = false }: { canManageAdmin?: boolean }) => {
	const {
		members,
		roles,
		permissions,
		lbyImporters,
		loading,
		error,
		updateRole,
		updatePermission,
		updateLbyPermission,
		savingMemberId,
	} = usePanelMembers();
	const [saveError, setSaveError] = useState(false);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		PpicStatus | "inactive" | null
	>(null);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
	const [draftRole, setDraftRole] = useState<PpicRole>("MEMBER");
	const [draftStatuses, setDraftStatuses] = useState<PpicStatuses>([]);
	const [draftLbyImport, setDraftLbyImport] = useState(false);

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
				!hasPpicAdminAccess(roles[member.id]) && !permissions[member.id]?.length && !lbyImporters[member.id];
			return statusFilter === "inactive"
				? inactive
				: !inactive &&
						(!statusFilter || permissions[member.id]?.includes(statusFilter));
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
			if (roleChanged)
				await updateRole(editingMember.id, draftRole);
			if (draftRole === "MEMBER") {
				const savedStatuses = permissions[editingMember.id] ?? [];
				if (roleChanged || draftStatuses.length !== savedStatuses.length || draftStatuses.some((status) => !savedStatuses.includes(status)))
					await updatePermission(editingMember.id, draftStatuses.length ? draftStatuses : null);
			}
			if (draftRole !== "ADMIN" && (lbyImporters[editingMember.id] ?? false) !== draftLbyImport)
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

	if (loading || !members)
		return (
			<main
				className="mx-auto min-h-dvh max-w-lg bg-background pb-28"
				aria-busy="true"
			>
				<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-8 text-accent-foreground">
					<img
						src="/ayune-14.svg"
						alt=""
						aria-hidden="true"
						className="pointer-events-none absolute -top-20 -right-16 z-0 size-70 opacity-10"
					/>
					<div className="relative z-10 flex items-center gap-4">
						<div className="size-19 shrink-0 overflow-hidden">
							<img src="/icon.svg" alt="" className="size-full" />
						</div>
						<div>
							<p className="text-md text-muted-foreground/80">Pengaturan</p>
							<h1 className="text-2xl font-extrabold tracking-tight">
								Pengguna & aktivitas
							</h1>
						</div>
					</div>
					<p className="relative z-10 mt-2 text-sm text-muted-foreground">
						Ringkasan aktivitas scan dan pengaturan akses pengguna.
					</p>
				</header>
				<div
					className="space-y-3 p-4"
					role="status"
					aria-label="Loading members"
				>
					{Array.from({ length: 5 }, (_, index) => (
						<Skeleton key={index} className="h-32 rounded-2xl" />
					))}
				</div>
			</main>
		);

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-28">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-4 text-accent-foreground">
				<img
					src="/ayune-14.svg"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -top-20 -right-16 z-0 size-70 opacity-10"
				/>
				<div className="relative z-10 flex items-center gap-4">
					<div>
						<p className="text-md text-muted-foreground/80">Pengaturan</p>
						<h1 className="text-2xl font-extrabold tracking-tight">
							Pengguna & aktivitas
						</h1>
					</div>
				</div>
				<p className="relative z-10 my-2 text-sm text-muted-foreground">
					Ringkasan aktivitas scan dan pengaturan akses pengguna.
				</p>

				<div className="mx-auto pb-2">
					<div className="relative">
						<Search
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							aria-label="Search by name"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search by name"
							className="pl-10"
						/>
					</div>
				</div>
			</header>

			<section className="p-4">
				<div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
					<Button
						type="button"
						size="sm"
						variant={statusFilter === null ? "secondary" : "outline"}
						className="rounded-full font-medium"
						onClick={() => setStatusFilter(null)}
						aria-pressed={statusFilter === null}
					>
						Semua
					</Button>
					<Button
						type="button"
						size="sm"
						variant={statusFilter === "inactive" ? "secondary" : "outline"}
						className="rounded-full font-medium"
						onClick={() => setStatusFilter("inactive")}
						aria-pressed={statusFilter === "inactive"}
					>
						Nonaktif
					</Button>
					{statusOptions.map((option) => (
						<Button
							key={option.status}
							type="button"
							size="sm"
							variant={statusFilter === option.status ? "secondary" : "outline"}
							className="rounded-full font-medium"
							onClick={() => setStatusFilter(option.status)}
							aria-pressed={statusFilter === option.status}
						>
							{option.shortLabel}
						</Button>
					))}
				</div>

				<p className="mt-3 mb-2 text-sm text-muted-foreground">
					{filteredMembers.length} pengguna
				</p>
				{saveError && (
					<p className="mb-2 text-sm text-destructive" role="alert">
						Could not save access. Try again.
					</p>
				)}

				<div className="space-y-3">
					{filteredMembers.map((member) => {
						const selectedStatuses = permissions[member.id] ?? [];
						const role = roles[member.id] ?? "MEMBER";
						const initials = member.name
							.split(/\s+/)
							.slice(0, 2)
							.map((part) => part[0])
							.join("")
							.toUpperCase();

						return (
							<article
								key={member.id}
								className="relative rounded-2xl border bg-card p-4 shadow-sm"
							>
								<Button
									type="button"
									variant="ghost"
									className="absolute inset-0 size-full rounded-2xl"
									aria-label={`Lihat detail ${member.name}`}
									aria-haspopup="dialog"
									disabled={savingMemberId === member.id || (role === "ADMIN" && !canManageAdmin)}
									onClick={() => openEditor(member)}
								/>
								<div className="flex items-center gap-3">
									<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
										{initials}
									</div>
									<div className="min-w-0 flex-1">
										<h2 className="truncate capitalize font-bold">
											{member.name}
										</h2>
										<div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
											<span>{role === "ADMIN" ? "Admin" : role === "SUPER_ADMIN" ? "Super Admin" : "Member"}</span>
											{role !== "ADMIN" && lbyImporters[member.id] && <Badge variant="outline">Drafter</Badge>}
											{role === "MEMBER" && !selectedStatuses.length && !lbyImporters[member.id] && (
												<Badge
													variant="destructive"
													className="h-5 px-2 text-xs"
												>
													Nonaktif
												</Badge>
											)}
										</div>
									</div>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{statusOptions.map((option) => {
										const active = selectedStatuses.includes(option.status);
										return (
											<Badge
												key={option.status}
												variant="outline"
												style={
													{
														"--status-color": option.color,
														"--status-text-color": option.textColor,
													} as CSSProperties
												}
												className={
													active
														? STATUS_BADGE_CLASS_NAME
														: "border-dashed text-muted-foreground"
												}
											>
												{active && <Check />}
												{option.shortLabel}
											</Badge>
										);
									})}
								</div>
							</article>
						);
					})}
				</div>
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
											{roles[editingMember.id] === "ADMIN" ? "Admin" : roles[editingMember.id] === "SUPER_ADMIN" ? "Super Admin" : "Member"}
											{` · ${hasPpicAdminAccess(roles[editingMember.id]) || permissions[editingMember.id]?.length || lbyImporters[editingMember.id] ? "Aktif" : "Nonaktif"}`}
										</DrawerDescription>
									</div>
								</div>
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
											{PPIC_ROLES.filter((role) => role !== "ADMIN" || canManageAdmin).map((role) => (
												<Button
													key={role}
													type="button"
													variant={draftRole === role ? "outline" : "ghost"}
													className={draftRole === role ? "min-h-10 flex-1 bg-card" : "min-h-10 flex-1 bg-transparent"}
													onClick={() => setDraftRole(role)}
												>
													{role === "MEMBER" ? "Member" : role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
												</Button>
											))}
										</div>

										<p className="mt-6 border-b pb-2 text-sm text-muted-foreground">
											Akses halaman
										</p>
										<div className="divide-y">
											<div className="py-3">
												<label className="flex min-h-10 items-center gap-3">
													<span className="flex-1">Drafter: model LBY</span>
													<Checkbox checked={draftRole === "ADMIN" || draftLbyImport} disabled={draftRole === "ADMIN"}
														className="h-7 w-12 justify-start rounded-full border-input bg-muted p-1 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform data-checked:bg-accent data-checked:border-input data-checked:before:translate-x-5 **:data-[slot=checkbox-indicator]:hidden"
														onCheckedChange={(checked) => setDraftLbyImport(checked === true)} />
												</label>
												<p className="text-xs text-muted-foreground">Import, preview, dan aktifkan model. Akses scan diatur terpisah.</p>
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
