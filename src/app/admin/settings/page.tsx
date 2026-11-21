import { PageHeader } from "@/components/pageHeader";
import Link from "next/link";
import { Bell, Box, ChevronRight, Info, Moon, ShieldCheck, Users } from "lucide-react";

export default function Settings() {
	const groups = [
		{ title: "Kelola", items: [
			{ title: "Model LBY", description: "Import link, preview, dan aktifkan model", icon: Box, href: "/admin/import-3d" },
			{ title: "Pengguna & aktivitas", description: "Aktivitas scan, peran, akses halaman", icon: Users, href: "/admin/settings/users" },
			{ title: "Akses administrator", description: "Siapa saja yang jadi admin", icon: ShieldCheck, href: "/admin/settings/users" },
		] },
		{ title: "Preferensi", items: [
			{ title: "Notifikasi", description: "Retur dan barang baru diterima", icon: Bell },
			{ title: "Tampilan", description: "Ganti mode terang / gelap", icon: Moon },
			{ title: "Info akses ClickUp", description: "Cara panel dicocokkan", icon: Info, href: "/admin/settings/users" },
		] },
	];

	return (
		<main className="mx-auto min-h-dvh max-w-[480px] bg-background pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
			<PageHeader eyebrow="Admin" title="Settings" />
			<div className="px-4 pt-4">
				<p className="mb-[18px] text-sm text-muted-foreground">Kelola model, pengguna, dan preferensi aplikasi.</p>
				{groups.map((group) => (
					<section key={group.title} className="mb-[18px]" aria-label={group.title}>
						<h2 className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{group.title}</h2>
						<div className="divide-y overflow-hidden rounded-[20px] border bg-card">
							{group.items.map(({ title, description, icon: Icon, href }) => {
								const content = <><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{description}</span></span>{href ? <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" /> : <span className="text-xs text-muted-foreground">Segera hadir</span>}</>;
								return href ? <Link key={title} href={href} className="flex min-h-[68px] items-center gap-3 px-3.5 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">{content}</Link> : <div key={title} className="flex min-h-[68px] items-center gap-3 px-3.5 py-3">{content}</div>;
							})}
						</div>
					</section>
				))}
			</div>
		</main>
	);
}
