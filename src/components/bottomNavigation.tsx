"use client";

import { hasPpicAdminAccess } from "@/types/ppic";

import {
	FolderKanban,
	History,
	House,
	ScanLine,
	Search,
	User,
	Users,
} from "lucide-react";
import { Fragment } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { PpicRole } from "@/types/ppic";

const superAdminItems = [
	{ href: "/admin", label: "Home", icon: House },
	{ href: "/admin/projects", label: "Projects", icon: FolderKanban },
	{ href: "/admin/ubah-manual", label: "Scan", icon: ScanLine },
	{ href: "/admin/settings", label: "Member", icon: Users },
	{ href: "/admin/profile", label: "Profile", icon: User },
];
const memberItems = [
	{ href: "/projects", label: "Projects", icon: FolderKanban },
	{ href: "/cari-lokasi", label: "Cari", icon: Search },
	{ href: "/history", label: "History", icon: History },
	{ href: "/profile", label: "Profile", icon: User },
];
const drafterItems = [
	{ href: "/drafter", label: "Models", icon: FolderKanban },
	{ href: "/cari-lokasi", label: "Cari", icon: Search },
	{ href: "/drafter/profile", label: "Profile", icon: User },
];

const getNavigationItemsByRole = (role: PpicRole | null) => {
	if (hasPpicAdminAccess(role)) return superAdminItems;
	if (role === "MEMBER") return memberItems;
	return [];
};

function NavigationItemContent({
	active,
	icon: Icon,
	label,
}: {
	active: boolean;
	icon: typeof House;
	label: string;
}) {
	const { pending } = useLinkStatus();

	return (
		<>
			{pending && (
				<span
					aria-hidden="true"
					data-navigation-pending
					className="pointer-events-none absolute inset-0 rounded-md bg-white/15"
				/>
			)}
			<Icon
				aria-hidden="true"
				className={`relative size-4 shrink-0 ${pending ? "motion-safe:animate-pulse" : ""}`}
				strokeWidth={active || pending ? 3 : 2}
			/>
			<span className={`relative ${pending ? "font-bold" : ""}`}>{label}</span>
		</>
	);
}

export function BottomNavigation({
	role,
	workspace,
}: {
	role: PpicRole | null;
	workspace?: "drafter";
}) {
	const pathname = usePathname();
	if (pathname === "/login") return null;
	const navigationItems =
		workspace === "drafter" ? drafterItems : getNavigationItemsByRole(role);
	if (!navigationItems.length) return null;

	return (
		<nav
			aria-label="Main navigation"
			className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-(--bottom-navigation-height) max-w-lg items-center rounded-t-2xl border border-border/70 bg-primary px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-lg"
		>
			{navigationItems.map(({ href, label, icon: Icon }, index) => {
				const active =
					pathname === href ||
					(href === "/admin/ubah-manual" && pathname.startsWith(`${href}/`)) ||
					(href === "/admin/projects" && pathname === "/admin/project");
				const className = `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-xs text-white ${
					active ? "font-bold bg-white/10" : "font-medium"
				}`;
				return (
					<Fragment key={href}>
						{index > 0 && (
							<span
								aria-hidden="true"
								className="mx-1 h-7 w-px shrink-0 bg-white/10"
							/>
						)}
						<Link
							href={href}
							aria-current={active ? "page" : undefined}
							className={className}
						>
							<NavigationItemContent
								active={active}
								icon={Icon}
								label={label}
							/>
						</Link>
					</Fragment>
				);
			})}
		</nav>
	);
}
