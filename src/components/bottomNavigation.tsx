"use client";

import {
	FolderKanban,
	History,
	LogOut,
	Search,
	ScanLine,
	User,
	Users,
} from "lucide-react";
import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ppicStatusPath } from "@/lib/produksiPanel";
import type { PpicRole, PpicStatuses } from "@/types/ppic";

const superAdminItems = [
	{ href: "/admin", label: "Projects", icon: FolderKanban },
	{ href: "/admin/ubah-manual", label: "Scan", icon: ScanLine },
	{ href: "/admin/settings", label: "Member", icon: Users },
	{ href: "/admin/profile", label: "Profile", icon: User },
];
const memberItems = [
	{ href: "/projects", label: "Projects", icon: FolderKanban },
	{ href: "/history", label: "History", icon: History },
	{ href: "/profile", label: "Profile", icon: User },
];

const getNavigationItemsByRole = (role: PpicRole | null, allowedStatuses: PpicStatuses | null) => {
	if (role === "SUPER_ADMIN") return superAdminItems;
	if (role === "MEMBER")
		return [
			...memberItems,
			...(allowedStatuses ?? []).map((status) => ({
				href: ppicStatusPath(status),
				label: status.replaceAll("_", " "),
				icon: ScanLine,
			})),
		];
	return [{ href: "/api/auth/logout", label: "Logout", icon: LogOut }];
};

export function BottomNavigation({
	role,
	allowedStatuses,
}: {
	role: PpicRole | null;
	allowedStatuses: PpicStatuses | null;
}) {
	const pathname = usePathname();
	if (pathname === "/login") return null;
	const navigationItems = getNavigationItemsByRole(role, allowedStatuses);

	return (
		<nav
			aria-label="Main navigation"
			className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg items-center rounded-t-2xl border border-border/70 bg-primary px-3 py-3 shadow-lg"
		>
			{navigationItems.map(({ href, label, icon: Icon }, index) => {
				const active = pathname === href;
				const className = `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs text-white ${
					active ? "font-bold bg-white/10" : "font-medium"
				}`;
				const content = (
					<>
						<Icon
							aria-hidden="true"
							className="size-4 shrink-0"
							strokeWidth={active ? 3 : 2}
						/>
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
