"use client";

import { hasPpicAdminAccess } from "@/types/ppic";

import {
	FolderKanban,
	History,
	House,
	LoaderCircle,
	ScanLine,
	Search,
	Settings,
	User,
	Users,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { PpicRole } from "@/types/ppic";

const superAdminItems = [
	{ href: "/admin", label: "Home", icon: House },
	{ href: "/admin/projects", label: "Projects", icon: FolderKanban },
	{ href: "/admin/ubah-manual", label: "Scan", icon: ScanLine },
	{ href: "/admin/settings", label: "Settings", icon: Settings },
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
	icon: Icon,
	label,
}: {
	icon: typeof House;
	label: string;
}) {
	const { pending } = useLinkStatus();

	return (
		<>
			{pending && (
				<LoaderCircle
					data-navigation-pending
					aria-hidden="true"
					className="absolute top-1 right-2 size-3 motion-safe:animate-spin"
				/>
			)}
			<Icon
				aria-hidden="true"
				className="relative size-5 shrink-0"
				strokeWidth={1.8}
			/>
			<span className="relative">{label}</span>
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
			className="fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom,0px))] z-50 mx-auto flex max-w-116 items-center rounded-3xl bg-primary p-1.5 text-primary-foreground"
		>
			{navigationItems.map(({ href, label, icon: Icon }) => {
				const active =
					pathname === href ||
					(href === "/admin/ubah-manual" && pathname.startsWith(`${href}/`)) ||
					(href === "/admin/projects" && pathname === "/admin/project");
				const className = `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.75 rounded-[18px] px-0 py-2 text-[11px] font-semibold ${
					active ? "bg-primary-foreground/10" : ""
				}`;
				return (
					<Link
						key={href}
						href={href}
						aria-current={active ? "page" : undefined}
						className={className}
					>
						<NavigationItemContent icon={Icon} label={label} />
					</Link>
				);
			})}
		</nav>
	);
}
