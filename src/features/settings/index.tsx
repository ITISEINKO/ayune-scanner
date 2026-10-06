"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import type { PanelMember } from "@/types/clickup";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export const SettingPage = () => {
	const [members, setMembers] = useState<PanelMember[] | null>(null);
	const [error, setError] = useState(false);
	const [openMemberId, setOpenMemberId] = useState<string | null>(null);
	const [statusByMember, setStatusByMember] = useState<
		Record<string, string | null>
	>({});
	const [saveError, setSaveError] = useState(false);
	const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
	const statusOptions = [
		{
			status: "BARANG_DITERIMA",
			label: "Barang Diterima",
		},
		{
			status: "SEDANG_DIPACKING",
			label: "Sedang Dipacking",
		},
		{ status: null, label: "Not active" },
	];

	useEffect(() => {
		fetch("/api/panel/members", { cache: "no-store" })
			.then(async (response) => {
				const data = (await response.json()) as {
					members?: PanelMember[];
					permissions?: Record<string, string | null>;
				};
				if (!response.ok || !data.members) throw new Error("members");
				setMembers(data.members);
				setStatusByMember(data.permissions ?? {});
			})
			.catch(() => setError(true));
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
			<h1>Settings</h1>
			{saveError && (
				<p className="mt-2 text-sm text-destructive" role="alert">
					Could not save permission. Try again.
				</p>
			)}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Status</TableHead>
						<TableHead className="w-12" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => (
						<TableRow key={member.id}>
							<TableCell>{member.name}</TableCell>
							<TableCell>
								{statusOptions.find(
									(option) => option.status === statusByMember[member.id],
								)?.label ?? "Not active"}
							</TableCell>
							<TableCell className="relative">
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Set status for ${member.name}`}
									aria-expanded={openMemberId === member.id}
									disabled={savingMemberId === member.id}
									onClick={() =>
										setOpenMemberId((id) =>
											id === member.id ? null : member.id,
										)
									}
								>
									<Settings2 />
								</Button>
								{openMemberId === member.id && (
									<div
										role="menu"
										className="absolute right-2 z-10 mt-1 min-w-44 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
									>
										{statusOptions.map((option) => (
											<button
												key={option.label}
												type="button"
												role="menuitem"
												className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
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
														setStatusByMember((statuses) => ({
															...statuses,
															[member.id]: option.status,
														}));
														setOpenMemberId(null);
													} catch {
														setSaveError(true);
													} finally {
														setSavingMemberId(null);
													}
												}}
											>
												{option.label}
											</button>
										))}
									</div>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</main>
	);
};
