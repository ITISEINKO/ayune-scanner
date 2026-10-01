"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";

export type ProductionItem = {
	barcode: string;
	step: string | null;
	progress: number | null;
	qc_result: string | null;
	kendala: string | null;
	last_scan: unknown;
};

export function ProductionSheet({ production, onClose }: { production: ProductionItem; onClose: () => void }) {
	return (
		<Drawer open onOpenChange={(open) => !open && onClose()} snapPoints={["32rem", 1]} showSwipeHandle>
			<DrawerContent className="max-h-[calc(100dvh-1rem)] rounded-t-3xl border-t border-border bg-background shadow-2xl">
				<div className="flex-1 overflow-y-auto p-5 pb-8">
					<p className="text-sm font-bold text-primary">PRODUKSI</p>
					<DrawerTitle className="text-2xl font-bold">{production.barcode}</DrawerTitle>
					<DrawerDescription className="sr-only">Detail produksi</DrawerDescription>
					<div className="my-5 rounded-2xl bg-card p-5 text-center">
						<p className="text-sm text-muted-foreground">Tahap Produksi</p>
						<p className="mt-1 text-2xl font-black text-card-foreground">{production.step ?? "Belum ditentukan"}</p>
					</div>
					<dl className="grid grid-cols-2 gap-3 text-sm">
						<div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">Progress</dt><dd className="mt-1 text-lg font-bold">{production.progress === null ? "-" : `${production.progress}%`}</dd></div>
						<div className="rounded-xl bg-secondary p-3"><dt className="text-muted-foreground">QC Result</dt><dd className="mt-1 text-lg font-bold">{production.qc_result ?? "-"}</dd></div>
					</dl>
					{production.kendala && (
						<Alert variant="destructive" className="mt-3">
							<TriangleAlert />
							<AlertTitle>Kendala produksi</AlertTitle>
							<AlertDescription>{production.kendala}</AlertDescription>
						</Alert>
					)}
					<Button className="mt-5 w-full text-base" onClick={onClose}>SCAN BARCODE LAIN</Button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
