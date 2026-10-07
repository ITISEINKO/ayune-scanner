"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SessionRefresh() {
	const pathname = usePathname();
	const router = useRouter();
	const refreshed = useRef(false);

	useEffect(() => {
		if (refreshed.current || pathname === "/login") return;
		refreshed.current = true;
		void fetch("/api/auth/refresh", { cache: "no-store" }).then((response) => {
			if (response.ok) router.refresh();
		});
	}, [pathname, router]);

	return null;
}
