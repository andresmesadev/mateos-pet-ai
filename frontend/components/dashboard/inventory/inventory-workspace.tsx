"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Package, PackagePlus, Search, RotateCw, Plus, TriangleAlert, Clock3, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";
import { formatPosMoney } from "@/lib/pos-checkout";
import { stockLabel } from "@/lib/inventory-display";
import { useInventoryOperation } from "@/lib/use-inventory-operation";
import { USE_NAMES, type InventoryProduct, type InventoryMovement, type ProductUse } from "@/lib/inventory";
import { InventoryOperationStatus } from "./operation-status";
import { ProductForm } from "./product-form";
import { ProductDetail } from "./product-detail";
import { StockForm } from "./stock-form";
import { ConsumptionButton } from "./consumption-button";

const selectClass = "mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-primary";
const views = [
  { value: "", label: "Todos los productos", icon: Package },
  { value: "low", label: "Necesitan reposición", icon: PackagePlus },
  { value: "expiring", label: "Vencen en 30 días", icon: Clock3 },
  { value: "expired", label: "Con unidades vencidas", icon: TriangleAlert },
];

export function InventoryWorkspace() {
  const access = useDashboardAccess(), tenant = useTenant(), manage = !!access?.capabilities.inventory_manage;
  const [rows, setRows] = useState<InventoryProduct[]>([]);
  const [search, setSearch] = useState(""), [use, setUse] = useState(""), [status, setStatus] = useState("");
  const [inactive, setInactive] = useState(false), [cursor, setCursor] = useState(""), [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<InventoryProduct | "new" | null>(null), [selected, setSelected] = useState<InventoryProduct | null>(null);
  const [stock, setStock] = useState<{ product: InventoryProduct; mode: "entry" | "count" | "correction"; source?: InventoryMovement } | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]), [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false), [historyError, setHistoryError] = useState("");
  const historyRequest = useRef<AbortController | null>(null);
  const saved = useCallback(() => { setRefresh(n => n + 1); }, []);
  const operation = useInventoryOperation(saved);
  const url = useCallback((path: string) => proxyUrl(path + (tenant ? (path.includes("?") ? "&" : "?") + "tenantId=" + encodeURIComponent(tenant) : "")), [tenant]);

  useEffect(() => {
    if (!access?.capabilities.inventory_read) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true); setError("");
      try {
        const params = new URLSearchParams({ search, use, status, includeInactive: inactive ? "1" : "0", limit: "30" });
        if (cursor) params.set("cursor", cursor);
        const r = await fetch(url("/api/dashboard/inventory/products?" + params), { cache: "no-store", signal: abort.signal });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "No se pudo cargar el inventario.");
        if (!abort.signal.aborted) { setRows(data.data); setNext(data.nextCursor); }
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Inventario no disponible."); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [search, use, status, inactive, cursor, refresh, url, access?.capabilities.inventory_read]);
  useEffect(() => () => historyRequest.current?.abort(), []);

  async function history(p: InventoryProduct, after?: string) {
    historyRequest.current?.abort();
    const abort = new AbortController(); historyRequest.current = abort;
    setHistoryBusy(true); setHistoryError("");
    try {
      const r = await fetch(url(`/api/dashboard/inventory/products/${p.id}/movements${after ? "?cursor=" + encodeURIComponent(after) : ""}`), { cache: "no-store", signal: abort.signal });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "No se pudo cargar el historial.");
      if (!abort.signal.aborted) { setMovements(list => after ? [...list, ...data.data] : data.data); setHistoryCursor(data.nextCursor); }
    } catch (e) { if (!abort.signal.aborted) setHistoryError(e instanceof Error ? e.message : "Historial no disponible."); }
    finally { if (!abort.signal.aborted) setHistoryBusy(false); }
  }
  function closeDetail() { historyRequest.current?.abort(); setSelected(null); }
  function openDetail(p: InventoryProduct) {
    historyRequest.current?.abort(); setSelected(p); setMovements([]); setHistoryCursor(null); setHistoryError("");
    if (manage) void history(p);
  }
  function clearFilters() { setSearch(""); setUse(""); setStatus(""); setInactive(false); setCursor(""); }

  if (!access) return <p role="status" className="p-6">Comprobando permisos…</p>;
  if (!access.capabilities.inventory_read) return <p className="p-6">Tu perfil no tiene acceso al inventario.</p>;
  const disabled = operation.busy || operation.pending.length > 0;
  const filtered = !!(search || use || status || inactive);
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4"><div className="rounded-2xl bg-teal-100 p-3 text-primary"><Package className="h-7 w-7" /></div><div><h1 className="text-3xl font-bold tracking-tight">Inventario</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Controla productos e insumos, recibe mercancía y revisa lo que necesita reposición.</p></div></div>
      <div className="flex flex-wrap gap-2">{access.capabilities.inventory_consume && <ConsumptionButton area={access.capabilities.clinical ? "veterinary" : "grooming"} onSaved={saved} />}{manage && <Button disabled={disabled} onClick={() => setEditor("new")}><Plus />Nuevo producto</Button>}</div>
    </header>
    <InventoryOperationStatus operation={operation} />
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" aria-label="Productos y existencias">
      <div className="space-y-4 border-b p-5">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(200px,1fr)_210px_auto]">
          <label className="text-sm font-semibold">Buscar producto<div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => { setSearch(e.target.value); setCursor(""); }} className="h-11 pl-10 font-normal" placeholder="Nombre, código interno o código de barras" /></div></label>
          <label className="text-sm font-semibold">Área de uso<select value={use} onChange={e => { setUse(e.target.value); setCursor(""); }} className={selectClass}><option value="">Todas mis áreas</option>{(["retail", "veterinary", "grooming"] as ProductUse[]).filter(u => access.activeModules.includes(u) && (manage || (u === "retail" ? access.capabilities.cash : u === "veterinary" ? access.capabilities.clinical : access.capabilities.grooming))).map(u => <option key={u} value={u}>{USE_NAMES[u]}</option>)}</select></label>
          <Button variant="outline" className="h-11" disabled={busy} onClick={() => setRefresh(n => n + 1)}><RotateCw className={busy ? "animate-spin" : ""} />Actualizar</Button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado de existencias">{views.map(view => <Button key={view.value} variant={status === view.value ? "default" : "outline"} aria-pressed={status === view.value} onClick={() => { setStatus(view.value); setCursor(""); }}><view.icon />{view.label}</Button>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><p>Disponible = apto para venta o uso. Una unidad corresponde a la presentación del producto.</p>{manage && <label className="flex items-center gap-2"><input type="checkbox" checked={inactive} onChange={e => { setInactive(e.target.checked); setCursor(""); }} className="size-4 accent-teal-700" />Incluir desactivados</label>}</div>
        {filtered && <Button variant="ghost" size="sm" onClick={clearFilters}><ListFilter />Limpiar filtros</Button>}
      </div>
      {error ? <div role="alert" className="p-6 text-red-800">{error}<Button className="ml-3" variant="outline" onClick={() => setRefresh(n => n + 1)}>Reintentar</Button></div> : busy ? <p role="status" className="p-8 text-sm text-muted-foreground">Consultando existencias…</p> : !rows.length ? <div className="p-10 text-center"><Package className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-3 font-semibold">{filtered ? "No hay productos con estos filtros" : "Comienza tu inventario"}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{filtered ? "Prueba otro nombre, código o estado de existencias." : manage ? "Registra un producto con su presentación y luego ingresa las unidades recibidas." : "Administración puede registrar los productos de tu área."}</p>{filtered ? <Button className="mt-4" variant="outline" onClick={clearFilters}>Ver todos los productos</Button> : manage && <Button className="mt-4" disabled={disabled} onClick={() => setEditor("new")}><Plus />Registrar primer producto</Button>}</div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm"><caption className="sr-only">Productos, presentación, disponibilidad y acciones de inventario</caption><thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th scope="col" className="px-5 py-3 font-medium">Producto</th><th scope="col" className="px-4 py-3 font-medium">Área de uso</th><th scope="col" className="px-4 py-3 text-right font-medium">Existencias</th><th scope="col" className="px-4 py-3 font-medium">Estado</th>{access.capabilities.cash && <th scope="col" className="px-4 py-3 text-right font-medium">Precio de venta</th>}<th scope="col" className="px-5 py-3 text-right font-medium">Acciones</th></tr></thead><tbody>{rows.map(p => {
          const health = stockLabel(p);
          return <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20"><td className="px-5 py-4"><button className="rounded text-left font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => openDetail(p)}>{p.name}</button><p className="mt-1 text-xs text-muted-foreground">{p.internalCode} · {p.category}</p><p className="mt-1 text-xs text-muted-foreground">1 unidad: {p.presentation}</p></td><td className="px-4 py-4 text-xs text-muted-foreground">{p.uses.map(u => USE_NAMES[u]).join(" · ")}</td><td className="px-4 py-4 text-right"><p className={`text-lg font-bold tabular-nums ${health.tone === "warning" ? "text-amber-800" : ""}`}>{p.available} <span className="text-xs font-normal">disponibles</span></p><p className="mt-1 text-xs tabular-nums text-muted-foreground">{p.physical} físicas · mínimo {p.stockMinimum}</p></td><td className="px-4 py-4"><div className="flex flex-col items-start gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${health.tone === "warning" ? "bg-amber-50 text-amber-900" : health.tone === "good" ? "bg-teal-50 text-teal-800" : "bg-muted text-muted-foreground"}`}>{health.text}</span>{BigInt(p.expired) > BigInt(0) && <span className="text-xs font-medium text-red-800">{p.expired} vencidas</span>}{p.lots.some(l => l.expiresSoon && l.physical > 0 && l.available > 0) && <span className="text-xs font-medium text-amber-900">Vence en 30 días</span>}</div></td>{access.capabilities.cash && <td className="px-4 py-4 text-right tabular-nums">{p.salePrice != null ? formatPosMoney(p.salePrice) : <span className="text-xs text-muted-foreground">Sin precio</span>}</td>}<td className="px-5 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openDetail(p)}>Ver detalle</Button>{manage && p.active && <Button size="sm" disabled={disabled} onClick={() => setStock({ product: p, mode: "entry" })}><PackagePlus />Entrada</Button>}</div></td></tr>;
        })}</tbody></table>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4"><span className="text-xs text-muted-foreground">{busy ? "Actualizando listado…" : `${error ? 0 : rows.length} productos en esta página`}</span><div className="flex gap-2">{cursor && <Button size="sm" variant="outline" disabled={busy} onClick={() => setCursor("")}>Primera página</Button>}{next && !error && <Button size="sm" variant="outline" disabled={busy} onClick={() => setCursor(next)}>Siguientes productos</Button>}</div></div>
    </section>
    {editor && <ProductForm key={editor === "new" ? "new" : editor.id} product={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={saved} />}
    {stock && <StockForm key={stock.product.id + stock.mode} {...stock} onClose={() => setStock(null)} onSaved={saved} />}
    {selected && <ProductDetail key={selected.id} product={selected} manage={manage} cash={!!access.capabilities.cash} disabled={disabled || !operation.ready}
      movements={movements} historyBusy={historyBusy} historyError={historyError} hasMore={!!historyCursor}
      onClose={closeDetail} onRetry={() => void history(selected)} onMore={() => void history(selected, historyCursor ?? undefined)}
      onEdit={() => { setEditor(selected); closeDetail(); }} onEntry={() => { setStock({ product: selected, mode: "entry" }); closeDetail(); }}
      onCount={() => { setStock({ product: selected, mode: "count" }); closeDetail(); }} onCorrect={source => { setStock({ product: selected, mode: "correction", source }); closeDetail(); }}
      onToggleActive={async () => { if (await operation.execute("set_product_active", `/api/dashboard/inventory/products/${selected.id}`, { active: !selected.active, expectedVersion: selected.metadataVersion }, `${selected.active ? "Desactivar" : "Activar"} ${selected.name}`, "PATCH")) closeDetail(); }} />}
  </div>;
}
