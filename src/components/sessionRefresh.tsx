"use client";

import * as Ably from "ably";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SessionRefresh({
	refreshAfter,
	refreshedAt,
	userId,
}: {
	refreshAfter: number;
	refreshedAt: number;
	userId: string | null;
}) {
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		if (pathname === "/login") return;
		const refresh = async (redirectToState = false) => {
			const response = await fetch("/api/auth/refresh", { cache: "no-store" });
			if (!response.ok) return;
			if (!redirectToState) return;
			const data = (await response.json()) as { path?: unknown };
			if (typeof data.path === "string") router.replace(data.path);
			router.refresh();
		};
		const timeout = window.setTimeout(() => {
			void refresh();
		}, refreshAfter);
		if (!userId) return () => window.clearTimeout(timeout);
		let closed = false;
		const realtime = new Ably.Realtime({ authUrl: "/api/ably/token" });
		const channel = realtime.channels.get(`ppic:member:${userId}`);
		const onSessionUpdated = () => void refresh(true);
		void channel.subscribe("session-updated", onSessionUpdated).catch((error) => {
			if (!closed) console.error(error);
		});
		return () => {
			closed = true;
			window.clearTimeout(timeout);
			channel.unsubscribe("session-updated", onSessionUpdated);
			realtime.close();
		};
	}, [pathname, refreshAfter, refreshedAt, router, userId]);

	return null;
}
