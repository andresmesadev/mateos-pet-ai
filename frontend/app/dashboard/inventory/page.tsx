import { Suspense } from "react";
import { InventoryWorkspace } from "@/components/dashboard/inventory/inventory-workspace";
export default function InventoryPage() {
  return <Suspense fallback={<p className="p-6" role="status">Cargando inventario…</p>}><InventoryWorkspace /></Suspense>;
}
