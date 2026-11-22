"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/pageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePanelMembers } from "@/hooks/use-panel-members";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";
import { hasPpicAdminAccess, PPIC_STATUSES } from "@/types/ppic";
import type { PpicStatus } from "@/types/ppic";

const statusOptions = PPIC_STATUSES.map((status) => ({
	status,
	...STATUS_COLOR_CONFIG[status],
}));

export const SettingPage = () => {
	const {
		members,
		roles,
		permissions,
		lbyImporters,
		loading,
		error,
		refreshError,
	} = usePanelMembers();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		PpicStatus | "inactive" | null
	>(null);
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
			<PageHeader
				eyebrow="Settings"
				title="Pengguna & aktivitas"
				backHref="/admin/settings"
			/>
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
						variant={statusFilter === null ? "secondary" : "outline"}
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
							variant={statusFilter === option.status ? "secondary" : "outline"}
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
						variant={statusFilter === "inactive" ? "secondary" : "outline"}
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
					<div className="mt-4 divide-y overflow-hidden rounded-[20px] border border-border/60 bg-card">
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
								<Link
									key={member.id}
									href={`/admin/users/${encodeURIComponent(member.id)}`}
									className="flex min-h-17 w-full items-center gap-3 px-3.5 py-2.75 text-left hover:bg-muted focus-visible:relative focus-visible:outline-2 focus-visible:outline-primary"
									aria-label={`Lihat detail ${member.name}`}
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
								</Link>
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
		</main>
	);
};
