export const PRODUKSI_LIST_ID = "1009328161956091194";
export const KENDALA_LIST_ID = "1009343515876540437";

export const CF = {
	TAHAP_PRODUKSI: "ef76056a-61db-4af0-a81c-34983b198d3b",
	BUKTI: "523f7b12-25ae-462b-9819-90036f0c9b8d",
	PROGRESS: "d8d74c67-0ebf-4b28-ac3b-1b5c58590de3",
	LAST_SCAN: "cccbf19f-568f-44d9-b976-6feb18800de7",
	START_PRODUCTION: "e51f6995-5eca-4cba-b482-0c98a3a5210a",
	TARGET_SELESAI: "26c99ef8-fef9-4591-971c-da1c4b64402c",
	BARCODE: "213fe4c2-0d5f-449f-a14b-4697d57dbfea",
	SKU: "b4f8792a-97ba-42df-a891-83884f23e896",
	CUSTOMER_PROJECT: "5fc890a4-78ed-44c8-87fc-085f7cf4337b",
	PIC_WORKSHOP: "71b54903-3cec-4ae5-ac8a-b0e88e5f8a12",
	KENDALA: "4c59d4e9-7163-4e4a-9c6e-41cbf2e911ff",
	DETAIL_KENDALA: "55f122d2-ebdb-4a9f-9b3a-62c0c4ab2390",
	QC_RESULT: "6f23f219-18fd-4362-a426-311eb8175e9d",
	PRODUCT_TYPE: "73db8b30-dbd7-40a7-b06c-34ad0ad96e40",
} as const;

export const TAHAP_FLOW = [
	{ name: "Handover Produksi", id: "aed58095-2219-407d-b2c6-bd5ab8d78fe4" },
	{ name: "Persiapan Material", id: "69078546-0bb0-4bcd-876b-a5b79172cd31" },
	{ name: "QC Material", id: "38f46866-844e-4cbb-b440-c166eb5f71a3" },
	{ name: "Pelapisan Bahan", id: "f8aef8f6-4a81-4972-a4f1-697cca587515" },
	{ name: "Marking & Cutting", id: "03bd2bce-5040-45bd-a872-930c623b4013" },
	{ name: "QC Hasil Potong", id: "0e963721-7304-4e34-8a3c-1eb3d8d735d0" },
	{ name: "Edging", id: "e1d36222-b657-421b-b6d5-45fe8d8ce185" },
	{ name: "Drilling", id: "cced9968-07af-44e6-a33a-33f60c1da556" },
	{ name: "Finishing Pelapisan", id: "10a95914-5696-4ecd-8788-92faade670b7" },
	{ name: "QC3 - QC WS", id: "c665e28f-9985-49df-b104-db883eda6f40" },
	{ name: "QC4 - QC Assembly", id: "461a8009-d352-4a11-a016-da03118b6617" },
	{ name: "Dis-assembling", id: "05b62bd8-7b01-42e8-812e-c1a43e2f6c9e" },
	{ name: "Packing", id: "a70b908f-d923-449d-adec-d51998373d53" },
	{ name: "Pengiriman", id: "dae12c83-8a31-41b8-96f2-726482feb647" },
] as const;

export const TAHAP_KOMPLAIN = { name: "Komplain", id: "44a218d2-479d-4713-ab89-ee03a75308c8" } as const;
export const QC = {
	PENDING: "5c2a5f7c-167e-4b2b-8d7c-c360a36299fc",
	PASS: "5eba903b-e8b3-43ae-84b6-f4fa5a3fa1fb",
	FAIL: "33dd6e12-5b46-4393-82b5-beed4dd51285",
} as const;

export const productionSteps = TAHAP_FLOW.map(({ name }) => name);
export type ProductionStep = (typeof TAHAP_FLOW)[number]["name"];
export type ProductionStage = ProductionStep | typeof TAHAP_KOMPLAIN.name;
export type ScanAction = "advance" | "qc" | "release_komplain";
export type QcResult = "Pass" | "Fail";

const progress: Record<ProductionStep, number> = {
	"Handover Produksi": 5,
	"Persiapan Material": 10,
	"QC Material": 15,
	"Pelapisan Bahan": 25,
	"Marking & Cutting": 35,
	"QC Hasil Potong": 45,
	Edging: 55,
	Drilling: 62,
	"Finishing Pelapisan": 70,
	"QC3 - QC WS": 78,
	"QC4 - QC Assembly": 85,
	"Dis-assembling": 90,
	Packing: 95,
	Pengiriman: 100,
};
const qcSteps = new Set<ProductionStep>(["QC Material", "QC Hasil Potong", "QC3 - QC WS", "QC4 - QC Assembly"]);

export const isProductionStage = (value: string): value is ProductionStage =>
	value === TAHAP_KOMPLAIN.name || productionSteps.includes(value as ProductionStep);
export const isReworkStep = (value: string): value is ProductionStep =>
	isProductionStage(value) && value !== TAHAP_KOMPLAIN.name && value !== "Pengiriman";
export const tahapById = (id: unknown) =>
	[...TAHAP_FLOW, TAHAP_KOMPLAIN].find((tahap) => tahap.id === id);
export const nextTahap = (id: unknown) => {
	const index = TAHAP_FLOW.findIndex((tahap) => tahap.id === id);
	return index < 0 ? null : TAHAP_FLOW[index + 1] ?? null;
};

export function moveProduction(
	current: ProductionStage,
	action: ScanAction,
	qcResult?: QcResult,
	reworkTo?: ProductionStep,
) {
	if (action === "qc" && qcSteps.has(current as ProductionStep) && qcResult) {
		const to = qcResult === "Fail" ? TAHAP_KOMPLAIN.name : productionSteps[productionSteps.indexOf(current as ProductionStep) + 1];
		return { to, progress: qcResult === "Fail" ? progress[current as ProductionStep] : progress[to as ProductionStep], qcResult };
	}
	if (action === "release_komplain" && current === TAHAP_KOMPLAIN.name && reworkTo)
		return { to: reworkTo, progress: progress[reworkTo], qcResult: "Pending" as const };
	if (action === "advance" && !qcSteps.has(current as ProductionStep)) {
		const next = productionSteps[productionSteps.indexOf(current as ProductionStep) + 1];
		if (next) return { to: next, progress: progress[next] };
	}
	return null;
}
