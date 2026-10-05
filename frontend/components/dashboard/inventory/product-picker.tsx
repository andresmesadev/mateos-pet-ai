"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, Package, Loader2 } from "lucide-react";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPosMoney } from "@/lib/pos-checkout";
import type { InventoryProduct, ProductUse } from "@/lib/inventory";

type Props = {
  use: ProductUse;
  onSelect: (product: InventoryProduct) => boolean | void;
  resetAfterSelect?: boolean;
  inputId?: string;
  focusRequest?: number;
  refreshRequest?: number;
  hideUntilSearch?: boolean;
  quantities?: Record<string, number>;
};

export function ProductPicker({ use, onSelect, resetAfterSelect = false, inputId, focusRequest = 0, refreshRequest = 0, hideUntilSearch = false, quantities = {} }: Props) {
  const tenant = useTenant();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(onSelect);
  const scanIntent = useRef<string | null>(null);
  const latestQuantities = useRef(quantities);
  const [search, setSearch] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const resultsVisible = !hideUntilSearch || browsing || !!search.trim();
  const [rows, setRows] = useState<InventoryProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => { selection.current = onSelect; latestQuantities.current = quantities; }, [onSelect, quantities]);
  useEffect(() => { if (focusRequest) input.current?.focus(); }, [focusRequest]);

  const choose = useCallback((product: InventoryProduct) => {
    const selected = latestQuantities.current[product.id] ?? 0;
    if (BigInt(product.available) <= BigInt(selected) || (use === "retail" && !(product.salePrice && product.salePrice > 0))) {
      setMessage("No hay más unidades disponibles para agregar.");
      input.current?.focus();
      return;
    }
    if (selection.current(product) === false) { input.current?.focus(); return; }
    setMessage(use === "retail" ? `${product.name} agregado a la venta.` : `${product.name} seleccionado.`);
    if (resetAfterSelect) {
      scanIntent.current = null;
      setSearch(""); setBrowsing(false); setBusy(false); setPage(""); setRows([]); setReload(value => value + 1);
      input.current?.focus();
    }
  }, [resetAfterSelect, use]);

  useEffect(() => {
    if (!resultsVisible) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true); setError("");
      try {
        const params = new URLSearchParams({ use, search: search.trim(), limit: "12" });
        if (tenant) params.set("tenantId", tenant);
        if (page) params.set("cursor", page);
        const response = await fetch(proxyUrl("/api/dashboard/inventory/products?" + params), { cache: "no-store", signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el catálogo.");
        if (abort.signal.aborted) return;
        setRows(data.data); setCursor(data.nextCursor); setActive(0);
        if (scanIntent.current === search.trim()) {
          scanIntent.current = null;
          const exact = (data.data as InventoryProduct[]).find(product => product.barcode === search.trim() || product.internalCode.toLowerCase() === search.trim().toLowerCase());
          if (exact) choose(exact);
          else setMessage("No hay un código exacto. Selecciona un resultado para agregarlo.");
        }
      } catch (cause) {
        if (!abort.signal.aborted) { scanIntent.current = null; setError(cause instanceof Error ? cause.message : "Catálogo no disponible."); }
      } finally { if (!abort.signal.aborted) setBusy(false); }
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [use, search, tenant, page, reload, refreshRequest, choose, resultsVisible]);

  const permitted = (product: InventoryProduct) => BigInt(product.available) > BigInt(quantities[product.id] ?? 0) && (use !== "retail" || (product.salePrice ?? 0) > 0);
  return <section className="space-y-3">
    <label className="block text-sm font-semibold">
      {use === "retail" ? "Buscar producto" : "Buscar insumo"}
      <span className="relative mt-2 block">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input ref={input} id={inputId} autoFocus autoComplete="off" className="h-12 bg-white pl-10" value={search} placeholder="Escanea el código o escribe el producto" onChange={event => {
          scanIntent.current = null; setSearch(event.target.value); setBrowsing(false); setPage(""); setRows([]); setCursor(null); setMessage(""); setBusy(!hideUntilSearch || !!event.target.value.trim());
        }} role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={resultsVisible && rows.length > 0} aria-activedescendant={resultsVisible && rows[active] ? `${listId}-${rows[active].id}` : undefined} onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); scanIntent.current = null; setSearch(""); setBrowsing(false); setRows([]); setCursor(null); setBusy(false); setPage(""); setMessage(""); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (rows.length) setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (busy || !rows.length) {
              if (search.trim()) { scanIntent.current = search.trim(); setMessage("Comprobando el código…"); setReload(value => value + 1); }
              return;
            }
            const exact = rows.find(product => product.barcode === search.trim() || product.internalCode.toLowerCase() === search.trim().toLowerCase());
            choose(exact ?? rows[active]);
          }
        }} />
      </span>
    </label>
    {hideUntilSearch && <Button type="button" variant="outline" aria-expanded={resultsVisible} aria-controls={listId} onClick={() => { scanIntent.current = null; setSearch(""); setPage(""); setRows([]); setCursor(null); setBusy(!resultsVisible); setBrowsing(!resultsVisible); }}>{resultsVisible ? "Ocultar catálogo" : "Ver catálogo de productos"}</Button>}
    <p className="text-xs text-muted-foreground">Nombre, código o barras. Usa ↑ ↓ y Enter para agregar. Se muestran unidades disponibles al consultar.</p>
    {resultsVisible && <>
    {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Buscando productos…</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <div id={listId} role="listbox" aria-label="Productos del inventario" className="max-h-64 space-y-1 overflow-y-auto">
      {rows.map((product, index) => <button type="button" id={`${listId}-${product.id}`} role="option" aria-selected={active === index} disabled={!permitted(product)} key={product.id} onFocus={() => setActive(index)} onClick={() => choose(product)} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left disabled:opacity-60 ${index === active ? "border-primary bg-accent" : "border-transparent hover:bg-muted"}`}>
        <Package className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1"><strong className="block break-words text-sm">{product.name}</strong><span className="block break-words text-xs text-muted-foreground">{product.internalCode} · {product.presentation}</span><span className={`text-xs ${BigInt(product.available) === BigInt(0) ? "text-red-700" : "text-muted-foreground"}`}>{product.available} disponibles{quantities[product.id] ? ` · ${quantities[product.id]} en carrito` : ""}{use === "retail" && !product.salePrice ? " · Sin precio de venta" : ""}</span></span>
        {use === "retail" && <strong className="shrink-0 text-sm tabular-nums">{formatPosMoney(product.salePrice ?? 0)}</strong>}
      </button>)}
    </div>
    {!busy && !error && !rows.length && <p className="text-sm text-muted-foreground">No hay productos para esta búsqueda. Administración puede registrarlos en Inventario.</p>}
    <div className="flex flex-wrap gap-2">{cursor && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setPage(cursor)}>Ver siguientes productos</Button>}{page && <Button type="button" size="sm" variant="ghost" onClick={() => setPage("")}>Volver al inicio</Button>}</div>
    </>}
    {message && <p role="status" className="text-sm font-medium text-primary">{message}</p>}
  </section>;
}
