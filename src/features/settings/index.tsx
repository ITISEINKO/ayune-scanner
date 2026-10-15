"use client";

import { useEffect, useState } from "react";
import { Check, Search, SlidersHorizontal } from "lucide-react";
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
import { usePanelMembers } from "@/hooks/use-panel-members";
import { PPIC_STATUSES } from "@/types/ppic";
import type { PanelMember } from "@/types/clickup";
import type { PpicRole, PpicStatus, PpicStatuses } from "@/types/ppic";

const statusOptions = [
	{
		status: PPIC_STATUSES[0],
		label: "Barang Diterima",
		shortLabel: "Diterima",
		variant: "green",
		dot: "bg-emerald-600",
	},
	{
		status: PPIC_STATUSES[1],
		label: "Sedang Dipacking",
		shortLabel: "Dipacking",
		variant: "blue",
		dot: "bg-blue-600",
	},
	{
		status: PPIC_STATUSES[2],
		label: "Terpasang / Digunakan",
		shortLabel: "Terpasang",
		variant: "purple",
		dot: "bg-violet-600",
	},
	{
		status: PPIC_STATUSES[3],
		label: "Dalam Proses Retur",
		shortLabel: "Retur",
		variant: "destructive",
		dot: "bg-red-600",
	},
] as const;

export const SettingPage = () => {
	const {
		members,
		roles,
		permissions,
		loading,
		error,
		updateRole,
		updatePermission,
		savingMemberId,
	} = usePanelMembers();
	const [saveError, setSaveError] = useState(false);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<PpicStatus | null>(null);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
	const [draftRole, setDraftRole] = useState<PpicRole>("MEMBER");
	const [draftStatuses, setDraftStatuses] = useState<PpicStatuses>([]);

	useEffect(() => {
		const timeout = window.setTimeout(
			() => setDebouncedSearch(search.trim().toLowerCase()),
			250,
		);
		return () => window.clearTimeout(timeout);
	}, [search]);

	const filteredMembers =
		members?.filter(
			(member) =>
				member.name.toLowerCase().includes(debouncedSearch) &&
				(!statusFilter || permissions[member.id]?.includes(statusFilter)),
		) ?? [];
	const editingMember = members?.find(
		(member) => member.id === editingMemberId,
	);

	const openEditor = (member: PanelMember) => {
		setDraftRole(roles[member.id] ?? "MEMBER");
		setDraftStatuses(permissions[member.id] ?? []);
		setEditingMemberId(member.id);
	};

	const saveAccess = async () => {
		if (!editingMember) return;
		setSaveError(false);
		try {
			if ((roles[editingMember.id] ?? "MEMBER") !== draftRole)
				await updateRole(editingMember.id, draftRole);
			if (draftRole === "MEMBER")
				await updatePermission(
					editingMember.id,
					draftStatuses.length ? draftStatuses : null,
				);
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
							<p className="text-md text-muted-foreground/80">
								Pengaturan akses
							</p>
							<h1 className="text-2xl font-extrabold tracking-tight">
								Akses halaman PPIC
							</h1>
						</div>
					</div>
					<p className="relative z-10 mt-2 text-sm text-muted-foreground">
						Tentukan halaman yang boleh diakses oleh setiap pengguna.
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
						<p className="text-md text-muted-foreground/80">Pengaturan akses</p>
						<h1 className="text-2xl font-extrabold tracking-tight">
							Akses halaman PPIC
						</h1>
					</div>
				</div>
				<p className="relative z-10 my-2 text-sm text-muted-foreground">
					Tentukan halaman yang boleh diakses oleh setiap pengguna.
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
				<div className="flex gap-2 overflow-x-auto pb-1">
					<Button
						type="button"
						size="sm"
						variant={statusFilter === null ? "default" : "outline"}
						className="rounded-full font-medium"
						onClick={() => setStatusFilter(null)}
					>
						Semua
					</Button>
					{statusOptions.map((option) => (
						<Button
							key={option.status}
							type="button"
							size="sm"
							variant={statusFilter === option.status ? "default" : "outline"}
							className="rounded-full font-medium"
							onClick={() => setStatusFilter(option.status)}
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
								className="rounded-2xl border bg-card p-4 shadow-sm"
							>
								<div className="flex items-center gap-3">
									<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
										{initials}
									</div>
									<div className="min-w-0 flex-1">
										<h2 className="truncate capitalize font-bold">
											{member.name}
										</h2>
										<div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
											<span>{role === "SUPER_ADMIN" ? "Admin" : "Member"}</span>
											{role === "MEMBER" && !selectedStatuses.length && (
												<Badge
													variant="destructive"
													className="h-5 px-2 text-xs"
												>
													Nonaktif
												</Badge>
											)}
										</div>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={savingMemberId === member.id}
										onClick={() => openEditor(member)}
									>
										<SlidersHorizontal />
										Atur
									</Button>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{statusOptions.map((option) => {
										const active = selectedStatuses.includes(option.status);
										return (
											<Badge
												key={option.status}
												variant={active ? option.variant : "outline"}
												className={
													active
														? undefined
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
											{draftRole === "SUPER_ADMIN" ? "Admin" : "Member"}
											{draftRole === "MEMBER" &&
												` · ${draftStatuses.length} dari ${statusOptions.length} akses aktif`}
										</DrawerDescription>
									</div>
								</div>
							</DrawerHeader>

							<div className="overflow-y-auto px-6 py-5">
								<p className="mb-2 text-sm text-muted-foreground">Peran</p>
								<div className="grid grid-cols-2 rounded-xl bg-muted p-1">
									<Button
										type="button"
										variant={draftRole === "MEMBER" ? "outline" : "ghost"}
										className={
											draftRole === "MEMBER"
												? "min-h-10 bg-card"
												: "min-h-10 bg-transparent"
										}
										onClick={() => setDraftRole("MEMBER")}
									>
										Member
									</Button>
									<Button
										type="button"
										variant={draftRole === "SUPER_ADMIN" ? "outline" : "ghost"}
										className={
											draftRole === "SUPER_ADMIN"
												? "min-h-10 bg-card"
												: "min-h-10 bg-transparent"
										}
										onClick={() => setDraftRole("SUPER_ADMIN")}
									>
										Admin
									</Button>
								</div>

								<p className="mt-6 border-b pb-2 text-sm text-muted-foreground">
									Akses halaman
								</p>
								<div className="divide-y">
									{statusOptions.map((option) => (
										<label
											key={option.status}
											className="flex min-h-16 items-center gap-3 py-3"
										>
											<span className={`size-2.5 rounded-full ${option.dot}`} />
											<span className="flex-1">{option.label}</span>
											<Checkbox
												checked={draftStatuses.includes(option.status)}
												disabled={draftRole === "SUPER_ADMIN"}
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
						</>
					)}
				</DrawerContent>
			</Drawer>
		</main>
	);
};
