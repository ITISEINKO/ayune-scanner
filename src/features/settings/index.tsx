"use client";

import { useEffect, useState } from "react";
import { CircleOff, Package, PackageCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { PanelMember } from "@/types/clickup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
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

const loadMembers = async () => {
	const response = await fetch("/api/panel/members", { cache: "no-store" });
	const data = (await response.json()) as {
		members?: PanelMember[];
		permissions?: Record<string, string | null>;
	};
	if (!response.ok || !data.members) throw new Error("members");
	return { members: data.members, permissions: data.permissions ?? {} };
};

let cachedMembers: Awaited<ReturnType<typeof loadMembers>> | null = null;
let membersRequest: ReturnType<typeof loadMembers> | null = null;

export const SettingPage = () => {
	const [members, setMembers] = useState<PanelMember[] | null>(
		() => cachedMembers?.members ?? null,
	);
	const [error, setError] = useState(false);
	const [statusByMember, setStatusByMember] = useState<
		Record<string, string | null>
	>(() => cachedMembers?.permissions ?? {});
	const [saveError, setSaveError] = useState(false);
	const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
	const statusOptions = [
		{
			status: "BARANG_DITERIMA",
			label: "Barang Diterima",
			icon: PackageCheck,
			variant: "green",
		},
		{
			status: "SEDANG_DIPACKING",
			label: "Sedang Dipacking",
			icon: Package,
			variant: "blue",
		},
		{ status: null, label: "Not active", icon: CircleOff, variant: "muted" },
	] as const;

	useEffect(() => {
		if (cachedMembers) return;
		membersRequest ??= loadMembers().then((data) => {
			cachedMembers = data;
			return data;
		});
		membersRequest
			.then((data) => {
				setMembers(data.members);
				setStatusByMember(data.permissions);
			})
			.catch(() => {
				membersRequest = null;
				setError(true);
			});
	}, []);

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
	if (!members)
		return (
			<main className="flex min-h-dvh items-center justify-center p-4 pb-28">
				<span
					className="loader"
					role="status"
					aria-label="Loading channel members"
					style={{
						width: "4rem",
						borderWidth: "3px",
						borderRightColor: "var(--primary)",
					}}
				/>
			</main>
		);

	return (
		<main className="mx-auto min-h-dvh max-w-lg p-4 pb-28">
			<header className="mb-7 pt-3">
				<div className="mt-4 flex items-center gap-4">
					<div className="size-10 shrink-0 overflow-hidden">
						<img src="/icon.svg" alt="" className="size-full" />
					</div>
					<div>
						<p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
							Pengaturan akses
						</p>
						<h1 className="text-2xl font-black tracking-tight">
							Akses halaman PPIC
						</h1>
					</div>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					Tentukan halaman yang boleh diakses oleh setiap pengguna.
				</p>
			</header>
			{saveError && (
				<p className="mt-2 text-sm text-destructive" role="alert">
					Could not save permission. Try again.
				</p>
			)}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12" />
						<TableHead>Name</TableHead>
						<TableHead>Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => {
						const status =
							statusOptions.find(
								(option) => option.status === statusByMember[member.id],
							) ?? statusOptions[2];
						return (
						<TableRow key={member.id}>
							<TableCell>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Set status for ${member.name}`}
												disabled={savingMemberId === member.id}
											/>
										}
									>
										<Settings2 />
									</DropdownMenuTrigger>
									<DropdownMenuContent>
										{statusOptions.map((option) => (
											<DropdownMenuItem
												key={option.label}
												onClick={async () => {
													setSaveError(false);
													setSavingMemberId(member.id);
													try {
														const response = await fetch("/api/panel/members", {
															method: "POST",
															headers: {
																"Content-Type": "application/json",
															},
															body: JSON.stringify({
																user_id: member.id,
																allowed_status: option.status,
															}),
														});
														if (!response.ok) throw new Error("permission");
														setStatusByMember((statuses) => {
															const permissions = {
																...statuses,
																[member.id]: option.status,
															};
										if (cachedMembers)
											cachedMembers = { ...cachedMembers, permissions };
										return permissions;
									});
									toast.success("Status berhasil diperbarui.");
								} catch {
									setSaveError(true);
									toast.error("Gagal memperbarui status.");
								} finally {
														setSavingMemberId(null);
													}
												}}
											>
												<option.icon />
												{option.label}
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
							<TableCell>{member.name}</TableCell>
							<TableCell>
								<Badge variant={status.variant}>
									<status.icon />
									{status.label}
								</Badge>
							</TableCell>
						</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</main>
	);
};
