"use client";

import Link from "next/link";

export function MemberActivityTabs({
	activeTab,
}: {
	activeTab: "summary" | "activity";
}) {
	return (
		<nav
			aria-label="Navigasi anggota"
			className="grid h-11 grid-cols-2 rounded-xl bg-muted p-1"
		>
			<Link
				href="/activity"
				aria-current={activeTab === "summary" ? "page" : undefined}
				className={`flex items-center justify-center rounded-lg px-3 text-sm transition-colors ${
					activeTab === "summary"
						? "bg-accent font-semibold text-white"
						: "text-foreground/60 hover:text-foreground"
				}`}
			>
				Ringkasan
			</Link>
			<Link
				href="/activity?tab=activity"
				aria-current={activeTab === "activity" ? "page" : undefined}
				className={`flex items-center justify-center rounded-lg px-3 text-sm transition-colors ${
					activeTab === "activity"
						? "bg-accent font-semibold text-white"
						: "text-foreground/60 hover:text-foreground"
				}`}
			>
				Aktivitas
			</Link>
		</nav>
	);
}
