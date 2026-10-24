"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, CircleHelp, Menu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
	Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import {
	DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberScanOverview } from "@/features/settings/MemberScanOverview";
import type { summarizeAdminOverview, OverviewMember } from "@/lib/adminOverview";
import { STATUS_COLOR_CONFIG } from "@/lib/colorStatusConfig";

export function AdminDashboard({
	now, totals, projectsReady, projectCount, members,
}: {
	now: number;
	totals: ReturnType<typeof summarizeAdminOverview>;
	projectsReady: boolean;
	projectCount: number | null;
	members: OverviewMember[] | null;
}) {
	const router = useRouter();
	const [refreshing, startTransition] = useTransition();
	const [selectedMember, setSelectedMember] = useState<OverviewMember | null>(null);
	const teamReady = members !== null && members.every((member) => member.summary !== null);
	const team = (members ?? [])
		.filter((member) => (member.summary?.today ?? 0) > 0)
		.sort((a, b) =>
			(b.summary?.today ?? 0) - (a.summary?.today ?? 0) ||
			(b.summary?.total ?? 0) - (a.summary?.total ?? 0) ||
			a.name.localeCompare(b.name),
		);
	const attention = [
		...(projectsReady && totals.returns ? [{ label: `${totals.returns} barang dalam proses retur`, href: "/admin/projects" }] : []),
		...(teamReady && totals.idle ? [{ label: `${totals.idle} petugas belum scan hari ini`, href: "/admin/settings" }] : []),
		...(members && totals.noAccess ? [{ label: `${totals.noAccess} anggota belum punya akses scan`, href: "/admin/settings" }] : []),
	];
	const refresh = () => startTransition(() => router.refresh());
	const date = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full" }).format(now);

	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-background pb-28">
			<header className="relative overflow-hidden rounded-b-[2.5rem] bg-accent/30 px-6 pt-6 pb-5">
				<img
					src="/ayune-14.svg" alt="" aria-hidden="true"
					className="pointer-events-none absolute -top-20 -right-16 size-70 opacity-10"
				/>
				<div className="relative flex items-center justify-between">
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="rounded-full bg-background/85 px-4" />}>
							<Menu aria-hidden="true" />Menu
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem render={<Link href="/admin/projects" />}>Projects</DropdownMenuItem>
							<DropdownMenuItem render={<Link href="/admin/ubah-manual" />}>Scan</DropdownMenuItem>
							<DropdownMenuItem render={<Link href="/admin/settings" />}>Member</DropdownMenuItem>
							<DropdownMenuItem onClick={refresh} disabled={refreshing}>
								<RefreshCw aria-hidden="true" />Perbarui ringkasan
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Dialog>
						<DialogTrigger render={<Button variant="ghost" size="sm" className="rounded-full bg-background/85 px-4" />}>
							<CircleHelp aria-hidden="true" />Bantuan
						</DialogTrigger>
						<DialogContent>
							<DialogTitle>Tentang dashboard produksi</DialogTitle>
							<DialogDescription>Ringkasan project berjalan dan aktivitas anggota tim dalam WIB.</DialogDescription>
							<div className="space-y-3 text-sm text-muted-foreground">
								<p>Barang tercatat adalah komponen yang sudah memiliki status. Grup pendukung dan barang dihapus tidak dihitung. Data mengikuti detail project; gunakan Resync di detail untuk mengambil ulang data ClickUp.</p>
								<p>Scan dihitung dari riwayat anggota channel dengan role Member, termasuk scan berulang. Periode 7 hari mencakup hari ini dan 6 hari sebelumnya; hari ini belum penuh.</p>
								<p>Petugas aktif adalah anggota dengan akses scan yang sudah scan hari ini. Ketuk anggota tim untuk melihat detail aktivitas.</p>
							</div>
						</DialogContent>
					</Dialog>
				</div>
				<div className="relative mt-4">
					<p className="text-xs font-bold text-muted-foreground">{date}</p>
					<h1 className="mt-1 text-[27px] font-extrabold tracking-tight">Dashboard produksi</h1>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">Kondisi semua project dan tim, langsung dari hasil scan.</p>
				</div>
			</header>

			<div className="space-y-4 px-4 pt-4" aria-busy={refreshing}>
				{(!projectsReady || !teamReady) && (
					<div role="alert" className="rounded-2xl border border-border p-4 text-sm">
						<p>
							{!projectsReady ? "Ringkasan barang belum tersedia lengkap. " : ""}
							{!teamReady ? "Sebagian data tim belum dapat dimuat." : ""}
						</p>
						<Button variant="outline" size="sm" className="mt-2" onClick={refresh} disabled={refreshing}>
							Coba lagi
						</Button>
					</div>
				)}
				<Link href="/admin/projects" className="block rounded-3xl bg-primary p-5 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
					<h2 className="text-sm font-bold text-primary-foreground/75">Barang tercatat</h2>
					<p className="mt-1 text-[44px] leading-tight font-extrabold tracking-tight">{projectsReady ? `${totals.percentage}%` : "—"}</p>
					<p className="mt-1 text-xs text-primary-foreground/80">{projectsReady ? `${totals.recorded} dari ${totals.total} barang` : "Data barang belum lengkap"} · {projectCount ?? "—"} project berjalan</p>
					{projectsReady && (
						<span
							role="img"
							aria-label={totals.statuses.map(({ status, count }) => `${STATUS_COLOR_CONFIG[status].label}: ${count}`).join(", ")}
							className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/15"
						>
							{[...totals.statuses.filter(({ status }) => status !== "UNSCANNED"), totals.statuses[0]]
								.filter(({ count }) => count > 0).map(({ status, count }) => {
									const color = STATUS_COLOR_CONFIG[status];
									return <span key={status} aria-hidden="true" style={{
										flex: count,
										backgroundColor: "progressColor" in color ? color.progressColor : color.color,
									}} />;
								})}
						</span>
					)}
				</Link>

				<section aria-label="Aktivitas scan tim" className="grid grid-cols-3 gap-2.5">
					<article className="flex min-w-0 flex-col rounded-3xl bg-card p-3.5">
						<h2 className="min-h-10 text-xs font-bold leading-4 text-muted-foreground">Scan hari ini</h2>
						<p className="mt-2 text-[27px] leading-tight font-extrabold">{teamReady ? totals.today : "—"}</p>
						<p className={`mt-1 text-[11px] leading-4 ${totals.change > 0 ? "font-bold text-green-700" : "text-muted-foreground"}`}>{teamReady ? `${totals.change > 0 ? "+" : ""}${totals.change} dibanding kemarin` : "Data belum lengkap"}</p>
					</article>
					<article className="flex min-w-0 flex-col rounded-3xl bg-card p-3.5">
						<h2 className="min-h-10 text-xs font-bold leading-4 text-muted-foreground">Petugas aktif hari ini</h2>
						<p className="mt-2 text-[27px] leading-tight font-extrabold">{teamReady ? <>{totals.active}<span className="text-lg text-muted-foreground">/{totals.enabled}</span></> : "—"}</p>
						<p className="mt-1 text-[11px] leading-4 text-muted-foreground">{teamReady ? `${totals.idle} orang belum scan` : "Data belum lengkap"}</p>
					</article>
					<article className="flex min-w-0 flex-col rounded-3xl bg-card p-3.5">
						<h2 className="min-h-10 text-xs font-bold leading-4 text-muted-foreground">Scan 7 hari</h2>
						<p className="mt-2 text-[27px] leading-tight font-extrabold">{teamReady ? totals.week : "—"}</p>
						<p className="mt-1 text-[11px] leading-4 text-muted-foreground">{teamReady ? `rata-rata ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(totals.week / 7)} per hari` : "Data belum lengkap"}</p>
					</article>
				</section>

				<section aria-labelledby="attention-heading">
					<div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-muted-foreground">
						<h2 id="attention-heading" className="tracking-wide uppercase">Perlu perhatian</h2>
						<span>{attention.length} hal</span>
					</div>
					<div className="divide-y divide-border/40 overflow-hidden rounded-3xl bg-card">
						{attention.map((item) => (
							<Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm hover:bg-muted/50 focus-visible:bg-muted">
								<span>{item.label}</span>
								<ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
							</Link>
						))}
						{!attention.length && <p className="px-4 py-3.5 text-sm text-muted-foreground">{projectsReady && teamReady ? "Tidak ada hal yang perlu perhatian saat ini." : "Menunggu ringkasan lengkap."}</p>}
					</div>
				</section>

				<section id="team-today" aria-labelledby="team-heading" className="scroll-mt-4">
					<div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-muted-foreground">
						<h2 id="team-heading" className="tracking-wide uppercase">Tim hari ini</h2>
						<span>ketuk untuk detail</span>
					</div>
					<div className="divide-y divide-border/40 overflow-hidden rounded-3xl bg-card">
						{team.map((member) => {
							const peak = Math.max(1, ...(member.summary?.days.map((day) => day.count) ?? []));
							return (
							<button
								key={member.id} type="button" onClick={() => setSelectedMember(member)}
								className="flex w-full items-center gap-3 px-4 py-3 text-left even:bg-muted/30 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
							>
								<span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/25 text-sm font-extrabold">
									{member.name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase()}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-extrabold">{member.name}</span>
									<span className={`mt-0.5 block text-xs ${member.hasAccess ? "text-muted-foreground" : "font-bold text-amber-700"}`}>
										{!member.hasAccess ? "Belum punya akses" : `${member.summary?.total} scan 7 hari`}
									</span>
								</span>
								<span
									role="img"
									aria-label={`Scan harian: ${member.summary?.days.map((day) => `${day.date}: ${day.count}`).join(", ")}`}
									className="flex h-8 shrink-0 items-end gap-0.5"
								>
									{member.summary?.days.map((day, index) => (
										<span
											key={day.date} aria-hidden="true"
											className={`w-1 rounded-sm ${index === 6 ? "bg-primary/80" : "bg-accent/40"}`}
											style={{ height: `${Math.max(2, day.count / peak * 30)}px` }}
										/>
									))}
								</span>
								<span className="w-12 shrink-0 text-right">
									<span className="block text-2xl leading-6 font-extrabold">{member.summary?.today}</span>
									<span className="block text-[11px] text-muted-foreground">hari ini</span>
								</span>
							</button>
							);
						})}
						{!team.length && <p className="p-4 text-sm text-muted-foreground">{teamReady ? "Belum ada anggota yang scan hari ini." : "Aktivitas tim belum dapat dimuat lengkap."}</p>}
					</div>
					<p className="mt-3 px-1 text-[11px] text-muted-foreground">7 hari kalender · WIB · termasuk scan berulang</p>
				</section>
			</div>

			<Drawer
				open={!!selectedMember}
				onOpenChange={(open) => { if (!open) setSelectedMember(null); }}
			>
				<DrawerContent className="[--drawer-inset:0px]! mx-auto max-w-lg rounded-t-3xl bg-background">
					<DrawerHeader className="text-left">
						<DrawerTitle>{selectedMember?.name}</DrawerTitle>
						<DrawerDescription>Aktivitas scan anggota tim</DrawerDescription>
					</DrawerHeader>
					<div className="overflow-y-auto">
						{selectedMember && <MemberScanOverview key={selectedMember.id} memberId={selectedMember.id} />}
					</div>
					<DrawerFooter>
						<DrawerClose render={<Button variant="outline" />}>Tutup</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</main>
	);
}
