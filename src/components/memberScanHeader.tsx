import { Badge } from "@/components/ui/badge";

export function MemberScanHeader({
	section,
	title,
	status,
}: {
	section: string;
	title: string;
	status: string;
}) {
	return (
		<header className="mb-4 rounded-2xl bg-card p-4 shadow-sm">
			<div className="flex items-center gap-3">
				<div className="size-12 shrink-0 overflow-hidden">
					<img src="/icon.svg" alt="" className="size-full" />
				</div>
				<div className="min-w-0">
					<p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
						{section}
					</p>
					<h1 className="text-lg font-black tracking-tight">{title}</h1>
				</div>
			</div>
			<div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
				<p className="text-xs font-medium text-muted-foreground">Status Barang Scan</p>
				<Badge className="bg-primary text-[11px] text-primary-foreground">{status}</Badge>
			</div>
		</header>
	);
}
