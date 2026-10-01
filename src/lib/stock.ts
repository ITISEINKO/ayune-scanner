export type TransactionType = "IN" | "OUT";

export function calculateStock(currentStock: number, type: TransactionType, qty: number) {
  return type === "IN" ? currentStock + qty : currentStock - qty;
}
