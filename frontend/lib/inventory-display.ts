import type { InventoryProduct } from "./inventory";

export function stockLabel(product: Pick<InventoryProduct, "active" | "available" | "lowStock">) {
  if (!product.active) return { text: "Desactivado", tone: "muted" } as const;
  if (BigInt(product.available) === BigInt(0)) return { text: "Sin disponibles", tone: "warning" } as const;
  if (product.lowStock) return { text: "Reponer", tone: "warning" } as const;
  return { text: "Disponible", tone: "good" } as const;
}

// Display-only physical balance. Availability and approval stay on the server.
export function stockPreview(mode: "entry" | "count" | "correction", quantity: string, physical: string, lotPhysical = 0, correctionLimit?: number) {
  if (!/^\d+$/.test(quantity.trim())) return null;
  const value = Number(quantity);
  if (!Number.isSafeInteger(value) || value > 2_147_483_647 || value < (mode === "count" ? 0 : 1)) return null;
  if (correctionLimit !== undefined && value > correctionLimit) return null;
  const delta = mode === "count" ? value - lotPhysical : value;
  return { quantity: value, delta, physicalAfter: (BigInt(physical) + BigInt(delta)).toString() };
}

export function inventoryDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" });
}
