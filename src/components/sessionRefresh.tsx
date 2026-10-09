"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SessionRefresh({
	refreshAfter,
	refreshedAt,
}: {
	refreshAfter: number;
	refreshedAt: number;
}) {
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		if (pathname === "/login") return;
		const timeout = window.setTimeout(() => {
			void fetch("/api/auth/refresh", { cache: "no-store" }).then(
				(response) => {
					if (response.ok) router.refresh();
				},
			);
		}, refreshAfter);
		return () => window.clearTimeout(timeout);
	}, [pathname, refreshAfter, refreshedAt, router]);

	return null;
}
