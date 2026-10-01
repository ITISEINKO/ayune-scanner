export const productionSteps = [
  "Handover Produksi",
  "Persiapan Material",
  "QC Material",
  "Pelapisan Bahan",
  "Marking & Cutting",
  "QC Hasil Potong",
  "Edging",
  "Drilling",
  "Finishing Pelapisan",
  "QC3 - QC WS",
  "Komplain",
  "QC4 - QC Assembly",
  "Dis-assembling",
  "Packing",
  "Pengiriman",
] as const;

export type ProductionStep = (typeof productionSteps)[number];
export type ScanAction = "advance" | "qc" | "release_komplain";
export type QcResult = "Pass" | "Fail";

const progress: Partial<Record<ProductionStep, number>> = {
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

export const isProductionStep = (value: string): value is ProductionStep =>
  productionSteps.includes(value as ProductionStep);

export const isReworkStep = (value: string): value is ProductionStep =>
  isProductionStep(value) && value !== "Komplain" && value !== "Pengiriman";

export function moveProduction(
  current: ProductionStep,
  action: ScanAction,
  qcResult?: QcResult,
  reworkTo?: ProductionStep,
) {
  if (action === "qc" && qcSteps.has(current) && qcResult) {
    const to = qcResult === "Fail" ? "Komplain" : productionSteps[productionSteps.indexOf(current) + 1];
    return { to, progress: qcResult === "Fail" ? progress[current]! : progress[to]!, qcResult };
  }
  if (action === "release_komplain" && current === "Komplain" && reworkTo) {
    return { to: reworkTo, progress: progress[reworkTo]!, qcResult: "Pending" as const };
  }
  if (action === "advance" && !qcSteps.has(current) && current !== "Komplain" && current !== "Pengiriman") {
    const to = productionSteps[productionSteps.indexOf(current) + 1];
    return { to, progress: progress[to]! };
  }
  return null;
}
