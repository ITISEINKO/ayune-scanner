import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeColor } from "@/components/themeColor";

export function PageHeader({
	eyebrow,
	title,
	backHref,
	action,
	children,
}: {
	eyebrow: string;
	title: string;
	backHref?: string;
	action?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<header className="sticky top-0 z-6 overflow-hidden rounded-b-[26px] bg-[color-mix(in_srgb,var(--accent)_30%,var(--background))] px-5 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-4.5 text-foreground">
			<ThemeColor color="color-mix(in srgb, var(--accent) 30%, var(--background))" />
			<img
				src="/ayune-14.svg"
				alt=""
				aria-hidden="true"
				className="pointer-events-none absolute -top-13 -right-12 size-48 opacity-10"
			/>
			<div className="relative flex items-center gap-3">
				{backHref && (
					<Link
						href={backHref}
						aria-label="Kembali"
						className="relative grid size-10 shrink-0 place-items-center rounded-[14px] bg-muted focus-visible:outline-2 focus-visible:outline-primary"
					>
						<ChevronLeft size={20} aria-hidden="true" />
					</Link>
				)}
				<div className="relative min-w-0 flex-1">
					<p className="text-[13px] text-muted-foreground">{eyebrow}</p>
					<h1 className="truncate text-[21px] font-bold tracking-[-0.3px]">
						{title}
					</h1>
				</div>
				{action}
			</div>
			{children}
		</header>
	);
}
