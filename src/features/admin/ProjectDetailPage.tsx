import Link from "next/link";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Download,
	RefreshCw,
	Route,
	Square,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const itemProgress = [
	{ name: "HPL-Double+Plywood+19", progress: 14, total: 3 },
	{ name: "HPL-DALAM+Plywood+19", progress: 36, total: 4 },
];

const waitingStages = [
	{ name: "Cutting", total: 3 },
	{ name: "Edging", total: 1 },
	{ name: "Finishing", total: 2 },
];

const activityLog = [
	["00:51", "Gilang", "Countertop Panel", "Packing"],
	["00:11", "Fajar", "Front Edge Panel", "QC Final"],
	["23:08", "Fajar", "Countertop Panel", "QC Final"],
	["22:25", "Eka", "Front Edge Panel", "Assembly"],
	["22:22", "Eka", "Back Panel", "Assembly"],
	["22:16", "Eka", "Countertop Panel", "Assembly"],
	["22:14", "Gilang", "Right Side Panel", "Packing"],
	["20:55", "Dedi", "Front Edge Panel", "QC 1"],
];

const components = [
	{
		name: "Left Side Panel",
		id: "15370041506",
		material: "HPL-Double+Plywood+19",
		progress: "■■■■■■",
		progressLabel: "6 dari 6 selesai",
		status: "Eka · 20:52",
	},
	{
		name: "Right Side Panel",
		id: "15370041511",
		material: "HPL-Double+Plywood+19",
		progress: "■■■■■■",
		progressLabel: "6 dari 6 selesai",
		status: "Gilang · 22:14",
	},
	{
		name: "Right-Opening Door Panel",
		id: "15370041509",
		material: "HPL-Double+Plywood+19",
		progress: "■□□□□□□",
		progressLabel: "1 dari 7 selesai",
		status: "Andi · 13:34",
	},
	{
		name: "Left-Opening Door Panel",
		id: "15370041510",
		material: "HPL-Double+Plywood+19",
		progress: "□□□□□□□",
		progressLabel: "Belum dikerjakan",
		status: "belum",
	},
	{
		name: "Top Panel",
		id: "15370041512",
		material: "HPL-DALAM+Plywood+19",
		progress: "■■■■□□□",
		progressLabel: "4 dari 7 selesai",
		status: "Rudi · 10:12",
	},
];

export const ProjectDetailPage = () => {
	return (
		<main className="mx-auto min-h-dvh max-w-lg bg-muted/30 pb-28">
			<header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card px-4 py-3">
				<Link
					href="/admin"
					aria-label="Kembali ke project"
					className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
				>
					<ChevronLeft aria-hidden="true" className="size-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<p className="text-xs text-muted-foreground">AY-10712</p>
					<h1 className="truncate text-sm font-extrabold">
						Dalton Utara 17/18 (Lemari Display Lt. 1)
					</h1>
				</div>
				<button
					type="button"
					className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-bold transition-colors hover:bg-muted"
				>
					<Download aria-hidden="true" className="size-3.5" />
					CSV
				</button>
			</header>

			<div className="space-y-3 p-4">
				<Tabs defaultValue="all" aria-label="Rentang waktu" className="w-full">
					<TabsList className="grid h-11 w-full grid-cols-3 rounded-lg bg-card">
						<TabsTrigger
							value="today"
							className="h-full rounded-md data-active:bg-primary data-active:text-primary-foreground"
						>
							Hari ini
						</TabsTrigger>
						<TabsTrigger
							value="week"
							className="h-full rounded-md data-active:bg-primary data-active:text-primary-foreground"
						>
							7 hari
						</TabsTrigger>
						<TabsTrigger
							value="all"
							className="h-full rounded-md data-active:bg-primary data-active:text-primary-foreground"
						>
							Semua
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<section className="rounded-xl border bg-card p-4 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
								Level 1 · Project
							</p>
							<p className="mt-2 text-5xl leading-none font-black">
								27<span className="text-2xl">%</span>
							</p>
						</div>
					</div>
					<div
						role="progressbar"
						aria-label="Progress project"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={27}
						className="mt-4 h-3 overflow-hidden border bg-muted"
					>
						<div className="h-full bg-primary" style={{ width: "27%" }} />
					</div>
					<div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
						<p className="flex items-center gap-1.5 font-semibold">
							<Check aria-hidden="true" className="size-4 text-primary" />1
							selesai
						</p>
						<p className="flex items-center gap-1.5">
							<Route aria-hidden="true" className="size-4 text-primary" />3
							jalan
						</p>
						<p className="flex items-center gap-1.5">
							<Square
								aria-hidden="true"
								className="size-3.5 text-muted-foreground"
							/>
							3 belum
						</p>
						<p className="flex items-center gap-1.5">
							<RefreshCw
								aria-hidden="true"
								className="size-3.5 text-muted-foreground"
							/>
							0 rework
						</p>
					</div>
					<p className="mt-4 text-sm text-muted-foreground">
						Scan terakhir 13 jam lalu
					</p>
				</section>

				<section className="rounded-xl border bg-card p-4 shadow-sm">
					<div className="flex items-center justify-between">
						<h2 className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
							Level 2 · Per item
						</h2>
					</div>
					<div className="mt-4 space-y-4">
						{itemProgress.map((item) => (
							<div key={item.name}>
								<div className="flex items-baseline justify-between gap-3 text-sm">
									<p className="truncate ">{item.name}</p>
									<p className="shrink-0 font-semibold">
										{item.progress}% · {item.total}
									</p>
								</div>
								<div
									role="progressbar"
									aria-label={`Progress ${item.name}`}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-valuenow={item.progress}
									className="mt-2 h-2 overflow-hidden border bg-muted"
								>
									<div
										className="h-full bg-primary"
										style={{ width: `${item.progress}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="flex items-center justify-between px-4 pt-4">
						<h2 className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
							Level 3 · Komponen
						</h2>
					</div>
					<Tabs
						defaultValue="all"
						aria-label="Filter komponen"
						className="mt-3 w-full px-4"
					>
						<TabsList className="grid h-9 w-full grid-cols-5 rounded-md bg-muted p-0.5">
							<TabsTrigger
								value="all"
								className="h-full rounded-sm px-1 text-xs data-active:bg-primary data-active:text-primary-foreground"
							>
								Semua
							</TabsTrigger>
							<TabsTrigger
								value="done"
								className="h-full rounded-sm px-1 text-xs data-active:bg-primary data-active:text-primary-foreground"
							>
								Selesai
							</TabsTrigger>
							<TabsTrigger
								value="active"
								className="h-full rounded-sm px-1 text-xs data-active:bg-primary data-active:text-primary-foreground"
							>
								Jalan
							</TabsTrigger>
							<TabsTrigger
								value="pending"
								className="h-full rounded-sm px-1 text-xs data-active:bg-primary data-active:text-primary-foreground"
							>
								Belum
							</TabsTrigger>
							<TabsTrigger
								value="rework"
								className="h-full rounded-sm px-1 text-xs data-active:bg-primary data-active:text-primary-foreground"
							>
								Rework
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<div className="mt-3 divide-y border-t">
						{components.map((component) => (
							<article key={component.id} className="px-4 py-3">
								<div className="flex items-baseline justify-between gap-3">
									<h3 className="truncate text-sm font-bold">
										{component.name}
									</h3>
									<p className="shrink-0  text-xs text-muted-foreground">
										{component.id}
									</p>
								</div>
								<div className="mt-1 flex items-center gap-2">
									<p className="min-w-0 flex-1 truncate  text-xs text-muted-foreground">
										{component.material}
									</p>
									<ChevronRight
										aria-hidden="true"
										className="size-4 shrink-0 text-muted-foreground"
									/>
								</div>
								<div className="mt-2 flex items-center justify-between gap-3 text-xs">
									<span
										aria-label={component.progressLabel}
										className=" tracking-tight text-primary"
									>
										{component.progress}
									</span>
									<span className="shrink-0 text-muted-foreground">
										{component.status}
									</span>
								</div>
							</article>
						))}
					</div>
				</section>

				<section className="rounded-xl border bg-card p-4 shadow-sm">
					<div className="flex items-center justify-between">
						<h2 className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
							Nunggu di tahap
						</h2>
					</div>
					<div className="mt-4 space-y-3">
						{waitingStages.map((stage) => (
							<div key={stage.name} className="flex items-center gap-3 text-sm">
								<p className="w-17 shrink-0">{stage.name}</p>
								<div className="h-3 flex-1 border border-primary/40 bg-primary/10" />
								<p className="w-4 text-right font-bold">{stage.total}</p>
							</div>
						))}
					</div>
					<p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
						<Clock3 aria-hidden="true" className="size-4" />
						Menunggu update tahap berikutnya
					</p>
				</section>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="flex items-center justify-between px-4 py-3">
						<h2 className=" text-xs tracking-[0.2em] text-muted-foreground uppercase">
							Log aktivitas
						</h2>
					</div>
					<ul className="divide-y border-t" aria-label="Log aktivitas terbaru">
						{activityLog.map(([time, member, component, stage]) => (
							<li
								key={`${time}-${member}-${component}`}
								className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 px-4 py-2 text-xs"
							>
								<time className=" text-muted-foreground">{time}</time>
								<p className="min-w-0 truncate">
									<span className="font-bold">{member}</span>
									<span className="text-muted-foreground"> · </span>
									{component} <span className="text-muted-foreground">→</span>{" "}
									{stage}
								</p>
							</li>
						))}
					</ul>
				</section>
			</div>
		</main>
	);
};
