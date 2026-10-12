"use client";

import { useEffect, useState } from "react";
import {
	BadgeCheck,
	CircleOff,
	Package,
	PackageCheck,
	Search,
	Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuCheckboxItem,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { usePanelMembers } from "@/hooks/use-panel-members";
import { PPIC_ROLES, PPIC_STATUSES } from "@/types/ppic";
import type { PpicStatus } from "@/types/ppic";

export const SettingPage = () => {
	const [webhookEndpoint, setWebhookEndpoint] = useState("");
	const [webhookSecret, setWebhookSecret] = useState("");
	const [webhookSaving, setWebhookSaving] = useState(false);
	const [webhookError, setWebhookError] = useState("");
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
	useEffect(() => {
		const timeout = window.setTimeout(
			() => setDebouncedSearch(search.trim().toLowerCase()),
			250,
		);
		return () => window.clearTimeout(timeout);
	}, [search]);
	const filteredMembers =
		members?.filter((member) =>
			member.name.toLowerCase().includes(debouncedSearch),
		) ?? [];
	const statusOptions = [
		{
			value: PPIC_STATUSES[0],
			status: PPIC_STATUSES[0],
			label: "Barang Diterima",
			icon: PackageCheck,
			variant: "green",
		},
		{
			value: PPIC_STATUSES[1],
			status: PPIC_STATUSES[1],
			label: "Sedang Dipacking",
			icon: Package,
			variant: "blue",
		},
		{
			value: PPIC_STATUSES[2],
			status: PPIC_STATUSES[2],
			label: "Terpasang / Digunakan",
			icon: BadgeCheck,
			variant: "purple",
		},
		{
			value: "INACTIVE",
			status: null,
			label: "Not active",
			icon: CircleOff,
			variant: "muted",
		},
	] as const;
	const createWebhook = async () => {
		setWebhookSaving(true);
		setWebhookError("");
		try {
			const response = await fetch("/api/clickup/webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					endpoint: webhookEndpoint.trim(),
				}),
			});
			const data = await response.json();
			if (!response.ok || !data.webhook) throw new Error(data.error ?? "Gagal membuat webhook.");
			setWebhookSecret(data.webhook.secret ?? "");
			toast.success("Webhook ClickUp berhasil dibuat.");
		} catch (error) {
			setWebhookError(error instanceof Error ? error.message : "Gagal membuat webhook.");
		} finally {
			setWebhookSaving(false);
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
					className="mx-auto p-4"
					role="status"
					aria-label="Loading channel members"
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<Skeleton className="h-3 w-8 rounded-md" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-3 w-12 rounded-md" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-3 w-14 rounded-md" />
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Array.from({ length: 11 }, (_, index) => (
								<TableRow key={index}>
									<TableCell>
										<Skeleton className="size-8 rounded-md" />
									</TableCell>
									<TableCell>
										<div className="space-y-2">
											<Skeleton className="h-4 w-32 rounded-md" />
											<Skeleton className="h-3 w-16 rounded-md" />
										</div>
									</TableCell>
									<TableCell>
										<Skeleton className="h-6 w-28 rounded-md" />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
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

				<div className="mx-auto  pb-2">
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

			<div className="mx-auto p-4">
				<section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm">
					<h2 className="flex items-center gap-2 font-bold"><Settings2 className="size-4" /> ClickUp webhook</h2>
					<p className="mt-1 text-sm text-muted-foreground">Daftarkan webhook untuk perubahan status di list PPIC.</p>
					<div className="mt-4 space-y-3">
						<Input
							aria-label="Webhook endpoint"
							placeholder={`${typeof window === "undefined" ? "https://domain-anda.com" : window.location.origin}/api/clickup/scan-hook`}
							value={webhookEndpoint}
							onChange={(event) => setWebhookEndpoint(event.target.value)}
						/>
						<Button type="button" onClick={createWebhook} disabled={webhookSaving}>
							{webhookSaving ? "Membuat..." : "Buat webhook"}
						</Button>
						{webhookError && <p className="text-sm text-destructive" role="alert">{webhookError}</p>}
						{webhookSecret && (
							<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
								<p className="font-bold">Simpan secret ini sekarang</p>
								<code className="mt-1 block break-all">{webhookSecret}</code>
							</div>
						)}
					</div>
				</section>
				{saveError && (
					<p className="mt-2 text-sm text-destructive" role="alert">
						Could not save access. Try again.
					</p>
				)}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Edit</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredMembers.map((member) => {
							const selectedStatuses = permissions[member.id] ?? [];
							const selectedOptions = statusOptions.filter((option) =>
								selectedStatuses.includes(option.status as PpicStatus),
							);
							return (
								<TableRow key={member.id}>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label={`Set role for ${member.name}`}
														disabled={savingMemberId === member.id}
													/>
												}
											>
												<Settings2 />
											</DropdownMenuTrigger>
											<DropdownMenuContent>
												{PPIC_ROLES.map((role) => (
													<DropdownMenuItem
														key={role}
														onClick={() => {
															setSaveError(false);
															void updateRole(member.id, role)
																.then(() =>
																	toast.success("Role berhasil diperbarui."),
																)
																.catch(() => {
																	setSaveError(true);
																	toast.error("Gagal memperbarui role.");
																});
														}}
													>
														{role === "SUPER_ADMIN" ? "Admin" : "Member"}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
									<TableCell>
										<div>{member.name}</div>
										<div className="mt-1 text-xs text-muted-foreground">
											{roles[member.id] === "SUPER_ADMIN" ? "Admin" : "Member"}
										</div>
									</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button
														variant="ghost"
														className="h-auto p-0 hover:bg-transparent"
														aria-label={`Set status for ${member.name}`}
														disabled={
															savingMemberId === member.id ||
															roles[member.id] === "SUPER_ADMIN"
														}
													/>
												}
											>
												<Badge
													variant={selectedOptions.length ? "green" : "muted"}
												>
													{selectedOptions.length
														? selectedOptions
																.map((option) => option.label)
																.join(", ")
														: "Not active"}
												</Badge>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-56">
												{statusOptions.slice(0, 3).map((option) => (
													<DropdownMenuCheckboxItem
														key={option.value}
														checked={selectedStatuses.includes(
															option.status as never,
														)}
														onCheckedChange={(checked) => {
															setSaveError(false);
															const next = checked
																? [
																		...selectedStatuses,
																		option.status as PpicStatus,
																	]
																: selectedStatuses.filter(
																		(status) => status !== option.status,
																	);
															void updatePermission(
																member.id,
																next.length ? next : null,
															)
																.then(() =>
																	toast.success("Status berhasil diperbarui."),
																)
																.catch(() => {
																	setSaveError(true);
																	toast.error("Gagal memperbarui status.");
																});
														}}
													>
														<Badge variant={option.variant}>
															<option.icon />
															{option.label}
														</Badge>
													</DropdownMenuCheckboxItem>
												))}
												<DropdownMenuItem
													onClick={() => {
														setSaveError(false);
														void updatePermission(member.id, null)
															.then(() =>
																toast.success("Status berhasil diperbarui."),
															)
															.catch(() => {
																setSaveError(true);
																toast.error("Gagal memperbarui status.");
															});
													}}
												>
													Not active
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</main>
	);
};
