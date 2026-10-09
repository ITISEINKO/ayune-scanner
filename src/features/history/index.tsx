import { ClipboardCheck, History } from "lucide-react";

const historyPreview = [
	["Back Panel", "15370041516", "Edging", "16:13"],
	["Countertop Panel", "15370041518", "Edging", "16:13"],
	["Left Side Panel", "15370041596", "Edging", "16:03"],
	["Front Edge Panel", "15370041521", "Edging", "15:22"],
	["Top Panel", "15370041512", "Edging", "14:55"],
	["Right Side Panel", "15370041511", "Edging", "14:24"],
	["Side Filler", "15370041520", "Edging", "13:43"],
	["Vertical Divider", "15370041515", "Edging", "13:06"],
];

export const HistoryPage = () => {
	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 px-4 pt-8 pb-28">
			<header className="rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-lg">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs font-bold tracking-widest text-primary-foreground/70 uppercase">
							Aktivitas member
						</p>
						<h1 className="mt-1 text-2xl font-black tracking-tight">
							Riwayat Scan
						</h1>
					</div>
					<div className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/10">
						<History aria-hidden="true" className="size-6" />
					</div>
				</div>
				<p className="mt-3 text-sm text-primary-foreground/75">
					Semua hasil scan yang berhasil akan tampil di sini.
				</p>
			</header>

			<section className="mt-5 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
				<div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
					<div>
						<p className=" text-xs tracking-[0.16em] text-muted-foreground uppercase">
							AY-4272
						</p>
						<h2 className="mt-1 text-sm font-bold">Hari ini</h2>
					</div>
					<span className="rounded-full bg-accent/30 px-3 py-1 text-xs font-bold text-accent-foreground">
						{historyPreview.length} aksi
					</span>
				</div>
				<ul
					className="divide-y divide-border/70"
					aria-label="Riwayat scan hari ini"
				>
					{historyPreview.map(([name, serialNumber, stage, time]) => (
						<li
							key={serialNumber}
							className="flex items-center gap-3 px-5 py-3.5"
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
								<ClipboardCheck aria-hidden="true" className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-bold">{name}</p>
								<p className="mt-0.5 truncate  text-xs text-muted-foreground">
									{serialNumber} <span aria-hidden="true">·</span> {stage}
								</p>
							</div>
							<time className="shrink-0  text-xs font-semibold text-muted-foreground">
								07/10 {time}
							</time>
						</li>
					))}
				</ul>
			</section>
		</main>
	);
};
