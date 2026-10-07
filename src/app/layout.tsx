import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BottomNavigation } from "@/components/bottomNavigation";
import { SessionRefresh } from "@/components/sessionRefresh";
import { cn } from "@/lib/utils";
import { ppicSession } from "@/lib/session";

const jakartaSans = Plus_Jakarta_Sans({
	subsets: ["latin"],
	variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
	title: "Production Scanner",
	description: "Open production tasks in ClickUp by barcode.",
	manifest: "/manifest.webmanifest",
	icons: {
		icon: [
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon.ico", sizes: "any" },
		],
		apple: "/apple-touch-icon.png",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await ppicSession();

	return (
		<html lang="en" className={cn("light", "font-sans", jakartaSans.variable)}>
			<body>
				{children}
				<SessionRefresh />
				<BottomNavigation
					role={session?.role ?? null}
					allowedStatus={session?.allowed_status ?? null}
				/>
				<Toaster position="top-center" />
			</body>
		</html>
	);
}
