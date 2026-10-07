"use client";

import { useState } from "react";
import { CircleOff, Package, PackageCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
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
import { usePanelMembers } from "@/hooks/use-panel-members";
import { PPIC_ROLES, PPIC_STATUSES } from "@/types/ppic";

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
			value: "INACTIVE",
			status: null,
			label: "Not active",
			icon: CircleOff,
			variant: "muted",
		},
	] as const;

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
					{members.map((member) => {
						const status =
							statusOptions.find(
								(option) => option.status === permissions[member.id],
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
											<Badge variant={status.variant}>
												<status.icon />
												{status.label}
											</Badge>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-56">
											{statusOptions.map((option) => (
												<DropdownMenuItem
													key={option.value}
													onClick={() => {
														setSaveError(false);
														void updatePermission(member.id, option.status)
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
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</main>
	);
};
