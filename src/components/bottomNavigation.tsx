"use client";

import {
	Cog,
	LogOut,
	PackageCheck,
	PackageOpen,
	Search,
	Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PpicRole, PpicStatus } from "@/types/ppic";

const superAdminItems = [
	{ href: "/scan-to-find", label: "Find", icon: Search },
	{ href: "/ubah-manual", label: "Manual", icon: Settings2 },
	{ href: "/settings", label: "Settings", icon: Cog },
];
const memberItems = (allowedStatus: PpicStatus | null) => [
	{ href: "/scan-to-find", label: "Find", icon: Search },
	...(allowedStatus
		? [
				{
					href:
						allowedStatus === "BARANG_DITERIMA"
							? "/barang-diterima"
							: "/sedang-dipacking",
					label: "Scan",
					icon:
						allowedStatus === "BARANG_DITERIMA" ? PackageCheck : PackageOpen,
				},
			]
		: []),
	{ href: "/api/auth/logout", label: "Logout", icon: LogOut },
];

export function BottomNavigation({
	role,
	allowedStatus,
}: {
	role: PpicRole | null;
	allowedStatus: PpicStatus | null;
}) {
	const pathname = usePathname();
	if (pathname === "/login") return null;
	const navigationItems =
		role === "SUPER_ADMIN"
			? superAdminItems
			: role === "MEMBER"
				? memberItems(allowedStatus)
				: [{ href: "/api/auth/logout", label: "Logout", icon: LogOut }];

	return (
		<nav
			aria-label="Main navigation"
			className="fixed inset-x-0 bottom-0 z-50 flex  mx-auto  max-w-lg items-center justify-between rounded-t-2xl border border-border/70 bg-primary p-3 shadow-lg "
		>
			{navigationItems.map(({ href, label, icon: Icon }) => {
				const active = pathname === href;
				const className = `flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-md font-semibold transition-colors ${
					active
						? "bg-white text-primary"
						: "text-white hover:bg-white/20 hover:text-white"
				}`;
				const content = (
					<>
						<Icon aria-hidden="true" className="size-4 shrink-0" />
						<span>{label}</span>
					</>
				);
				return href === "/api/auth/logout" ? (
					<a key={href} href={href} className={className}>
						{content}
					</a>
				) : (
					<Link
						key={href}
						href={href}
						aria-current={active ? "page" : undefined}
						className={className}
					>
						{content}
					</Link>
				);
			})}
		</nav>
	);
}
