export type ProductUse = "retail" | "veterinary" | "grooming";
export const USE_NAMES: Record<ProductUse, string> = { retail: "Venta", veterinary: "Veterinaria", grooming: "Peluquería" };
export type InventoryProduct = {
  id: string; name: string; internalCode: string; barcode: string | null; category: string; presentation: string;
  uses: ProductUse[]; active: boolean; lotPolicy: "untracked" | "lot" | "lot_expiry";
  referenceCost?: number; salePrice?: number | null; stockMinimum: number; metadataVersion: number; priceVersion: number; stockRevision: number;
  available: string; physical: string; expired: string; lowStock: boolean;
  lots: { id: string; lotCode: string | null; expiresOn: string | null; physical: number; available: number; expiresSoon: boolean }[];
};
export type InventoryMovement = {
  id: string; operationId: string; kind: string; quantity: number; stockDelta: number; balanceAfter: number; occurredAt: string;
  actorName: string; reason: string | null; lotCodeSnapshot: string | null; presentationSnapshot: string; entryUnitCost: string | null;
};
export const MOVEMENT_NAMES: Record<string, string> = { entry: "Entrada", sale: "Venta", consumption: "Insumos utilizados", consumption_correction: "Corrección de consumo", adjustment_in: "Ajuste de entrada", adjustment_out: "Ajuste de salida", return_restock: "Devolución apta", return_discard: "Devolución no apta" };
