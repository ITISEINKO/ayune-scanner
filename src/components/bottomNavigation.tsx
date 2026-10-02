"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Search, Settings2, Zap } from "lucide-react";

const items = [
	{ href: "/", label: "Home", icon: House },
	{ href: "/auto-status-scan", label: "Auto", icon: Zap },
	{ href: "/manual-status-scan", label: "Manual", icon: Settings2 },
	{ href: "/scan-to-find", label: "Find", icon: Search },
];

export function BottomNavigation() {
	const pathname = usePathname();
	if (pathname === "/login" || pathname === "/unauthorized") return null;

	return (
		<nav
			aria-label="Main navigation"
			className="fixed inset-x-0 bottom-0 z-50 flex  items-center justify-between rounded-t-2xl border border-border/70 bg-primary p-3 shadow-lg "
		>
			{items.map(({ href, label, icon: Icon }) => {
				const active = pathname === href;
				return (
					<Link
						key={href}
						href={href}
						aria-current={active ? "page" : undefined}
						className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-md font-semibold transition-colors ${
							active
								? "bg-white text-primary"
								: "text-white hover:bg-white/20 hover:text-white"
						}`}
					>
						<Icon aria-hidden="true" className="size-4 shrink-0" />
						<span>{label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
