"use client";

import {
	Cog,
	BadgeCheck,
	LogOut,
	PackageCheck,
	PackageOpen,
	Search,
	Settings2,
} from "lucide-react";
import { Fragment } from "react";
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
							: allowedStatus === "SEDANG_DIPACKING"
								? "/sedang-dipacking"
								: "/terpasang-digunakan",
					label: "Scan",
					icon:
						allowedStatus === "BARANG_DITERIMA"
							? PackageCheck
							: allowedStatus === "SEDANG_DIPACKING"
								? PackageOpen
								: BadgeCheck,
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
			className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg items-center rounded-t-2xl border border-border/70 bg-primary px-3 py-2 shadow-lg"
		>
			{navigationItems.map(({ href, label, icon: Icon }, index) => {
				const active = pathname === href;
				const className = `flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
					active ? "bg-accent text-white" : "text-white/80 hover:text-white"
				}`;
				const content = (
					<>
						<Icon aria-hidden="true" className="size-4 shrink-0" />
						<span>{label}</span>
					</>
				);
				return (
					<Fragment key={href}>
						{index > 0 && (
							<span
								aria-hidden="true"
								className="mx-2 h-7 w-px shrink-0 bg-white/10"
							/>
						)}
						{href === "/api/auth/logout" ? (
							<a href={href} className={className}>
								{content}
							</a>
						) : (
							<Link
								href={href}
								aria-current={active ? "page" : undefined}
								className={className}
							>
								{content}
							</Link>
						)}
					</Fragment>
				);
			})}
		</nav>
	);
}
