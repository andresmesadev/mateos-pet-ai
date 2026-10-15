"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const TASKS: Record<string, { label: string; fields: string[] }> = {
  financial_history: { label: "Consultar historial financiero", fields: ["rangeStart", "rangeEnd"] },
  daily_close: { label: "Consultar cierre existente", fields: ["date"] },
  financial_period: { label: "Consultar período oficial", fields: ["periodStart", "periodEnd"] },
  prepare_expense: { label: "Preparar un gasto", fields: ["description", "amount", "responsible", "date", "category", "paymentMethod", "notes"] },
  inventory_search: { label: "Buscar productos y alertas", fields: ["search", "status", "use", "category"] },
  inventory_detail: { label: "Consultar producto, lotes y vencimientos", fields: ["productId"] },
  inventory_movements: { label: "Consultar movimientos de un producto", fields: ["productId"] },
  prepare_entry: { label: "Preparar entrada de inventario", fields: ["productId", "quantity", "unitCost", "lotCode", "expiresOn", "reason"] },
};
const LABELS: Record<string, string> = {
  rangeStart: "Desde", rangeEnd: "Hasta", periodStart: "Inicio del período", periodEnd: "Fin del período", date: "Fecha",
  description: "Descripción", amount: "Importe (COP)", responsible: "Responsable", category: "Categoría", paymentMethod: "Forma de pago", notes: "Notas",
  search: "Nombre, código o código de barras", status: "Alerta", use: "Área", productId: "Producto", quantity: "Cantidad de presentaciones", unitCost: "Costo unitario (COP)",
  lotCode: "Código de lote", expiresOn: "Vencimiento", reason: "Motivo", cursor: "Continuación del resultado anterior",
};
const CHOICES: Record<string, [string, string][]> = {
  expenseCategory: [["other", "Otro"], ["supplies", "Insumos"], ["utilities", "Servicios públicos"], ["rent", "Arriendo"], ["salary", "Salario"], ["equipment", "Equipos"], ["marketing", "Marketing"]],
  paymentMethod: [["cash", "Efectivo"], ["transfer", "Transferencia"], ["card", "Tarjeta"], ["other", "Otro"]],
  status: [["", "Todos"], ["low", "Stock bajo"], ["expiring", "Próximos a vencer"], ["expired", "Vencidos"]],
  use: [["", "Áreas permitidas"], ["retail", "Venta"], ["veterinary", "Veterinaria"], ["grooming", "Peluquería"]],
};
const inputStyle = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-teal-700";
type Api = (path: string, method?: string, body?: unknown) => Promise<unknown>;
function ProductPicker({ value, onChange, api }: { value: string; onChange: (value: string) => void; api: Api }) {
  const [search, setSearch] = useState(""); const [rows, setRows] = useState<{ id: string; name: string; presentation: string }[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [selected, setSelected] = useState("");
  async function find() {
    setBusy(true); setError("");
    try { const result = await api("/inventory/products?limit=30&search=" + encodeURIComponent(search)) as { data: typeof rows }; setRows(result.data); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo buscar."); } finally { setBusy(false); }
  }
  return <div className="col-span-full rounded-xl border p-4"><label className="text-sm font-medium">Buscar un producto registrado<input className={inputStyle} value={search} onChange={e => setSearch(e.target.value)} /></label>
    <Button className="mt-2" variant="outline" type="button" disabled={busy} onClick={() => void find()}>{busy ? "Buscando…" : "Buscar productos"}</Button>
    {value && <p className="mt-2 text-sm text-teal-800">{selected || "Producto seleccionado en la propuesta"}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <ul className="mt-2 max-h-64 space-y-1 overflow-auto">{rows.map(p => <li key={p.id}><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-teal-50 focus-visible:outline-2" onClick={() => { onChange(p.id); setSelected(`${p.name} · ${p.presentation}`); setRows([]); }}>{p.name} <span className="text-slate-500">· {p.presentation}</span></button></li>)}</ul>
  </div>;
}
export function TaskFields({ intent, fields, setFields, api }: { intent: string; fields: Record<string, string>; setFields: (fields: Record<string, string>) => void; api: Api }) {
  const set = (key: string, value: string) => setFields({ ...fields, [key]: value });
  return <div className="grid gap-4 sm:grid-cols-2">{TASKS[intent]?.fields.map(key => {
    if (key === "productId") return <ProductPicker key={key} value={fields[key] || ""} onChange={v => set(key, v)} api={api} />;
    const choices = key === "category" && intent === "prepare_expense" ? CHOICES.expenseCategory : CHOICES[key];
    const kind = /^(rangeStart|rangeEnd|periodStart|periodEnd|date|expiresOn)$/.test(key) ? "date" : "text";
    return <label className="text-sm font-medium text-slate-700" key={key}>{LABELS[key] || key}{choices ? <select className={inputStyle} value={fields[key] ?? choices[0][0]} onChange={e => set(key, e.target.value)}>{choices.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select> : <input className={inputStyle} type={kind} inputMode={["amount", "unitCost"].includes(key) ? "decimal" : key === "quantity" ? "numeric" : undefined} value={fields[key] || ""} onChange={e => set(key, e.target.value)} maxLength={key === "cursor" ? 1000 : 4000} />}</label>;
  })}</div>;
}
const RESULT_LABELS: Record<string, string> = {
  productName: "Producto", area: "Área", actorName: "Registrado por", actorRole: "Rol", countedQuantity: "Cantidad contada", lotCodeSnapshot: "Lote registrado", expiresOnSnapshot: "Vencimiento registrado", productCodeSnapshot: "Código registrado", productNameSnapshot: "Producto registrado", presentationSnapshot: "Presentación registrada", generated: "Reporte generado",
  ...LABELS, days: "Días", closed: "Cierre oficial", dailyClose: "Cierre del día", financialPeriod: "Período oficial", preview: "Vista previa", data: "Resultados", expense: "Gasto", movements: "Movimientos", voidedAt: "Fecha de anulación", voidReason: "Motivo de anulación",
  incomeTotal: "Ingresos", expenseTotal: "Gastos", netAmount: "Resultado neto", commissionTotal: "Comisiones", commissionsTotal: "Comisiones", total: "Total", date: "Fecha", name: "Nombre", internalCode: "Código", barcode: "Código de barras",
  available: "Disponible", physical: "Existencia física", expired: "Existencia vencida", lowStock: "Stock bajo", expiresSoon: "Próximo a vencer", presentation: "Presentación", lots: "Lotes", lotPolicy: "Control de lotes", stockMinimum: "Mínimo",
  referenceCost: "Costo de referencia", salePrice: "Precio de venta", active: "Activo", uses: "Usos", nextCursor: "Continuación", today: "Día de consulta", occurredAt: "Fecha", confirmedAt: "Confirmado", kind: "Tipo", stockDelta: "Cambio de stock", balanceBefore: "Saldo anterior", balanceAfter: "Saldo posterior", entryUnitCost: "Costo de entrada", notes: "Notas", reason: "Motivo", status: "Estado", responsible: "Responsable", error: "Observación", effect: "Efecto", message: "Información",
};
const HIDDEN = /(^id$|Id$|Hash$|Version$|Revision$|principalKey|^code$|^v$|scope|ordinal|priceSource|createdAt|updatedAt|replayed|nextCursor)/;
const VALUES: Record<string, string> = { admin: "Administrador", receptionist: "Recepción", active: "Activo", voided: "Anulado", cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro", untracked: "Sin lote", lot: "Por lote", lot_expiry: "Lote y vencimiento", register_entry: "Entrada", entry: "Entrada", retail: "Venta", veterinary: "Veterinaria", grooming: "Peluquería", ninguno: "Sin cambios" };
export function ResultDetails({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="text-slate-500">Sin dato</span>;
  if (typeof value === "boolean") return <span>{value ? "Sí" : "No"}</span>;
  if (Array.isArray(value)) return value.length ? <div className="space-y-3">{value.map((item, index) => <div key={index} className="rounded-lg border border-slate-200 p-3"><ResultDetails value={item} depth={depth + 1} /></div>)}</div> : <span className="text-slate-500">Sin resultados</span>;
  if (typeof value === "object") return <dl className="space-y-2">{Object.entries(value).filter(([key]) => !HIDDEN.test(key)).map(([key, item]) => <div key={key} className={depth ? "text-sm" : "text-sm sm:grid sm:grid-cols-[12rem_1fr] sm:gap-4"}><dt className="font-medium text-slate-600">{RESULT_LABELS[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt><dd className="min-w-0 break-words text-slate-900"><ResultDetails value={item} depth={depth + 1} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap break-words">{VALUES[String(value)] || String(value)}</span>;
}
