"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, CreditCard, Landmark, Loader2, Minus, Package, Pencil, Plus, ReceiptText, Search, ShoppingBag, ShoppingCart, Trash2, UserRound, Wallet } from "lucide-react";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { getPetEmoji } from "@/lib/pets";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type Transaction } from "@/lib/transactions";
import { addCheckoutLine, catalogueLineIssue, cashChange, checkoutPriceLabel, formatPosMoney, lineTotalCents, moneyInCents, productQuantities, validateCheckout, MAX_POS_QUANTITY, type CatalogueSnapshot, type CheckoutLine } from "@/lib/pos-checkout";
import { ReceiptDialog } from "./sale-receipt";
import { ServiceCatalog } from "./service-catalog";
import { draftKey, readStoredDraft, writeStoredDraft, removeStoredDraft, type SaleDraft } from "@/lib/pos-draft";
import { ProductPicker } from "@/components/dashboard/inventory/product-picker";
import type { InventoryProduct } from "@/lib/inventory";

type ClientResult = { id: string; name: string | null; phone: string; pets: { id: string; name: string; type: string }[] };
const METHODS = [{ value: "cash", icon: Banknote }, { value: "transfer", icon: Landmark }, { value: "card", icon: CreditCard }, { value: "other", icon: Wallet }] as const;
const PAYMENT_GUIDANCE: Record<PaymentMethod, { label: string; placeholder: string; hint: string }> = {
  cash: { label: "Nota del cobro", placeholder: "Observación de esta venta", hint: "Revisa el efectivo recibido y entrega el cambio indicado." },
  transfer: { label: "Referencia de la transferencia", placeholder: "Ej. Banco y número de referencia", hint: "Verifica el abono en la cuenta del negocio antes de confirmar." },
  card: { label: "Referencia del comprobante", placeholder: "Ej. Número de autorización o comprobante", hint: "Confirma que el datáfono aprobó el pago. No ingreses datos de la tarjeta." },
  other: { label: "Detalle del pago", placeholder: "Ej. Medio utilizado y referencia", hint: "Verifica que recibiste el valor completo y describe el medio utilizado." },
};
const newLine = (itemKind: CheckoutLine["itemKind"]): CheckoutLine => ({ id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "", itemKind });

function ClientSearch({ selected, onSelect }: { selected: ClientResult | null; onSelect: (client: ClientResult | null) => void }) {
  const tenant = useTenant();
  const [query, setQuery] = useState(selected?.name || selected?.phone || "");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResults([]); setMessage(""); setActive(0);
      if (selected || query.trim().length < 2) { setSearching(false); return; }
      setSearching(true);
      try {
        const params = new URLSearchParams({ search: query.trim(), limit: "8" });
        if (tenant) params.set("tenantId", tenant);
        const response = await fetch(proxyUrl(`/api/dashboard/clients?${params}`), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudieron buscar clientes. Vuelve a escribir para reintentar.");
        const payload = await response.json();
        if (!controller.signal.aborted) { const found = Array.isArray(payload) ? payload : payload.data ?? []; setResults(found); setMessage(found.length ? "" : "No hay coincidencias. Puedes continuar como venta de mostrador."); }
      } catch (cause) { if (!controller.signal.aborted) setMessage(cause instanceof Error ? cause.message : "No se pudo buscar."); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, selected, tenant]);
  function choose(client: ClientResult) { onSelect(client); setQuery(client.name || client.phone); setResults([]); setMessage(""); }
  return <div className="relative" onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <label htmlFor="pos-client" className="mb-2 block text-sm font-medium">Cliente o propietario <span className="font-normal text-muted-foreground">(opcional)</span></label>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="pos-client" role="combobox" aria-autocomplete="list" aria-controls="pos-clients" aria-expanded={focused && results.length > 0} aria-activedescendant={focused && results[active] ? `pos-client-${active}` : undefined} autoComplete="off" className="pl-10 pr-10" placeholder="Nombre o teléfono" value={query} onChange={event => { setQuery(event.target.value); setResults([]); onSelect(null); }} onKeyDown={event => {
      if (event.key === "Escape") { setResults([]); return; }
      if (!results.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length); }
      if (event.key === "Enter") { event.preventDefault(); choose(results[active]); }
    }} />{searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}</div>
    {focused && results.length > 0 && <div id="pos-clients" role="listbox" aria-label="Clientes encontrados" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border bg-white shadow-lg">{results.map((client, index) => <button id={`pos-client-${index}`} role="option" aria-selected={active === index} type="button" key={client.id} onClick={() => choose(client)} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent ${active === index ? "bg-accent" : ""}`}><UserRound className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{client.name || "Sin nombre"}</span><span className="text-xs text-muted-foreground">{client.phone}</span></span><span className="text-xs text-muted-foreground">{client.pets?.length ?? 0} mascotas</span></button>)}</div>}
    {message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
  </div>;
}

type CatalogueStatus = { product?: CatalogueSnapshot; error?: string };
async function readCatalogue(ids: string[], tenant: string | null, signal?: AbortSignal): Promise<Record<string, CatalogueStatus>> {
  return Object.fromEntries(await Promise.all(ids.map(async id => {
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/inventory/products/${encodeURIComponent(id)}${tenantQuery(tenant)}`), { cache: "no-store", signal });
      const product = await response.json();
      if (!response.ok) throw new Error(response.status === 404 ? "El producto ya no está disponible en este catálogo. Retíralo de la venta." : product.error || "No se pudo comprobar este producto. Reintenta antes de cobrar.");
      return [id, { product }] as const;
    } catch (cause) { return [id, { error: cause instanceof Error ? cause.message : "No se pudo comprobar este producto." }] as const; }
  })));
}

export function SaleForm({ draftScope }: { draftScope: string | null }) {
  const access = useDashboardAccess();
  const tenant = useTenant();
  const [client, setClient] = useState<ClientResult | null>(null);
  const [petId, setPetId] = useState("");
  const [lines, setLines] = useState<CheckoutLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<"products" | "services">("products");
  const [catalogue, setCatalogue] = useState<Record<string, CatalogueStatus>>({});
  const [checking, setChecking] = useState(false);
  const [validationShown, setValidationShown] = useState(false);
  const [cartNotice, setCartNotice] = useState("");
  const [searchFocus, setSearchFocus] = useState(0);
  const [catalogReload, setCatalogReload] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const operationKey = useRef<string | null>(null);
  const operationBody = useRef<string | null>(null);
  const [canRecover, setCanRecover] = useState(false);
  const inFlight = useRef(false);
  const storageFailed = useRef(false);
  function persist(stage: SaleDraft["stage"]) {
    if (!draftScope) return false;
    try {
      const draft: SaleDraft = { version: 1, scope: draftScope, updatedAt: Date.now(), stage, lines, client, petId, paymentMethod, received, notes, ...(operationKey.current ? { operationKey: operationKey.current, ...(operationBody.current ? { operationBody: operationBody.current } : {}) } : {}) };
      writeStoredDraft(sessionStorage, localStorage, draft);
      return true;
    } catch (cause) { storageFailed.current = true; setDraftNotice(cause instanceof Error ? cause.message : "Tu navegador no permite conservar esta venta. Habilita el almacenamiento antes de cobrar."); return false; }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (draftScope) {
        try {
          const key = draftKey(draftScope);
          const restored = readStoredDraft(sessionStorage, localStorage, draftScope);
          if (restored) {
            operationKey.current = restored.operationKey ?? null;
            operationBody.current = restored.operationBody ?? null;
            setCanRecover(!!restored.operationKey);
            setLines(restored.lines); setClient(restored.client); setPetId(restored.petId); setPaymentMethod(restored.paymentMethod); setReceived(restored.received); setNotes(restored.notes); setGeneration(value => value + 1);
            setDraftNotice("Recuperamos la venta que dejaste en preparación.");
            if (restored.stage === "verify") { setUncertain(true); setError(restored.operationKey ? "Este cobro se estaba enviando. Consulta su resultado o reintenta la misma venta." : "Este cobro anterior no conserva una clave de recuperación. Compruébalo en Caja antes de descartarlo."); }
          } else sessionStorage.removeItem(key);
        } catch { storageFailed.current = true; setDraftNotice("Tu navegador no permite conservar esta venta al salir."); }
      } else setDraftNotice("No se pudo habilitar la recuperación de esta venta. Mantén esta pestaña abierta hasta cobrar.");
      setDraftReady(true);
      }, 0);
    return () => clearTimeout(timer);
  }, [draftScope]);
  useEffect(() => {
    if (!draftReady || !draftScope || transaction || storageFailed.current) return;
    try {
      if (!lines.length && !client && !notes && !uncertain && !saving) sessionStorage.removeItem(draftKey(draftScope));
      else writeStoredDraft(sessionStorage, localStorage, { version: 1, scope: draftScope, updatedAt: Date.now(), stage: uncertain || saving ? "verify" : "preparing", lines, client, petId, paymentMethod, received, notes, ...(operationKey.current ? { operationKey: operationKey.current, ...(operationBody.current ? { operationBody: operationBody.current } : {}) } : {}) } satisfies SaleDraft);
    } catch { storageFailed.current = true; queueMicrotask(() => setDraftNotice("Tu navegador no permite conservar esta venta al salir.")); }
  }, [draftReady, draftScope, transaction, lines, client, petId, paymentMethod, received, notes, uncertain, saving]);
  const productIds = JSON.stringify([...new Set(lines.flatMap(line => line.productId ? [line.productId] : []))].sort());
  useEffect(() => {
    if (uncertain || transaction || productIds === "[]") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void readCatalogue(JSON.parse(productIds), tenant, controller.signal).then(result => {
        if (!controller.signal.aborted) setCatalogue(result);
      });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [productIds, tenant, uncertain, transaction]);
  const quantities = productQuantities(lines);
  const locked = saving || checking || uncertain || !!updating;
  const visibleCatalog = access?.capabilities.retail && access.capabilities.services ? catalogTab : access?.capabilities.retail ? "products" : "services";
  const lineIssues = Object.fromEntries(lines.map(line => {
    const status = line.productId ? catalogue[line.productId] : undefined;
    const local = validationShown && access ? validateCheckout([line], access.capabilities)?.replace(/^Artículo 1: /, "") : null;
    return [line.id, local || status?.error || (status?.product ? catalogueLineIssue(line, status.product, quantities[status.product.id] ?? 0) : null)];
  }));
  const totalCents = lines.reduce((total, line) => total + lineTotalCents(line), 0);
  const change = cashChange(totalCents, received);
  const selectedPet = client?.pets.find(pet => pet.id === petId);
  const paymentGuidance = PAYMENT_GUIDANCE[paymentMethod];
  const units = lines.reduce((total, line) => total + (/^\d+$/.test(line.quantity) && Number.isSafeInteger(Number(line.quantity)) ? Number(line.quantity) : 0), 0);
  const cashHref = `/dashboard/pos?tab=caja${tenant ? "&tenant=" + encodeURIComponent(tenant) : ""}`;
  function setLine(id: string, field: keyof CheckoutLine, value: string) { if (field === "description" || field === "unitPrice") setEditingLineId(id); setLines(previous => previous.map(line => line.id === id ? { ...line, [field]: value } : line)); setError(""); }
  function removeLine(id: string) { setLines(previous => previous.filter(line => line.id !== id)); if (editingLineId === id) setEditingLineId(null); setCartNotice(""); setError(""); }
  async function updateCatalogueLine(line: CheckoutLine) {
    if (!line.productId || locked || inFlight.current) return;
    setUpdating(line.id);
    try {
      const result = await readCatalogue([line.productId], tenant);
      const status = result[line.productId];
      setCatalogue(previous => ({ ...previous, ...result }));
      setCatalogReload(value => value + 1);
      if (!status.product) throw new Error(status.error);
      const product = status.product;
      if (!product.active || !product.uses.includes("retail") || !product.salePrice) throw new Error("Este producto ya no se puede vender. Retíralo de esta venta.");
      setLines(list => list.map(item => item.productId === product.id ? { ...item, description: product.name, unitPrice: String(product.salePrice), priceVersion: product.priceVersion, presentation: product.presentation } : item));
      setError(""); setCartNotice("Producto actualizado. Revisa el total y el efectivo recibido antes de confirmar.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo consultar el producto."); }
    finally { setUpdating(null); }
  }
  function addCartLine(line: CheckoutLine) {
    if (locked || inFlight.current) return false;
    const result = addCheckoutLine(lines, line);
    if (result.error) { setError(result.error); return false; }
    setLines(result.lines); setError("");
    if (!line.productId && (!line.description.trim() || !(moneyInCents(line.unitPrice)! > 0))) setEditingLineId(line.id);
    setCartNotice(line.productId && lines.some(item => item.productId === line.productId) ? `Sumamos una unidad de ${line.description}.` : `${line.description || "Artículo manual"} agregado al carrito.`);
    return true;
  }
  function addProduct(product: InventoryProduct) {
    setCatalogue(previous => previous[product.id]?.product && previous[product.id].product!.priceVersion > product.priceVersion ? previous : { ...previous, [product.id]: { product } });
    return addCartLine({ id: crypto.randomUUID(), description: product.name, itemKind: "product", quantity: "1", unitPrice: String(product.salePrice), productId: product.id, priceVersion: product.priceVersion, presentation: product.presentation });
  }
  function addLine(itemKind: CheckoutLine["itemKind"]) { addCartLine(newLine(itemKind)); }
  function changeQuantity(line: CheckoutLine, step: number) {
    const quantity = Number(line.quantity) + step;
    if (/^\d+$/.test(line.quantity) && quantity >= 1 && quantity <= MAX_POS_QUANTITY) setLine(line.id, "quantity", String(quantity));
  }
  function handleShortcuts(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.defaultPrevented || locked) return;
    if (event.key === "F2") {
      event.preventDefault(); setSearchFocus(value => value + 1);
    } else if (event.key === "F4") {
      event.preventDefault();
      (event.currentTarget.querySelector<HTMLInputElement>("#pos-received") ?? event.currentTarget.querySelector<HTMLButtonElement>("[data-pos-payment]"))?.focus();
    } else if (event.key === "F8") {
      event.preventDefault(); confirmButton.current?.focus();
    } else if (event.key === "Enter" && event.target instanceof HTMLElement && !["BUTTON", "TEXTAREA"].includes(event.target.tagName)) {
      // Quantity, customer and cash inputs must never submit an accidental sale.
      event.preventDefault();
    }
  }
  function reset() { operationKey.current = null; operationBody.current = null; setCanRecover(false); setLines([]); setClient(null); setPetId(""); setReceived(""); setNotes(""); setPaymentMethod("cash"); setError(""); setUncertain(false); setTransaction(null); setReceiptOpen(false); setClearOpen(false); setCatalogue({}); setValidationShown(false); setCartNotice(""); setEditingLineId(null); setGeneration(value => value + 1); }
  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (inFlight.current || checking || updating || (uncertain && !operationKey.current) || !access) return;
    setValidationShown(true);
    const issue = validateCheckout(lines, access.capabilities);
    if (issue) { setError(issue); return; }
    if (paymentMethod === "cash" && (!change || change.missing > 0)) { setError("Ingresa el efectivo recibido. Debe cubrir el total de la venta."); return; }
    const retry = !!operationKey.current;
    // A retry uses its frozen body; never preflight an already committed uncertain sale.
    if (!retry && productIds !== "[]") {
      inFlight.current = true; setChecking(true); setError("");
      try {
        const checked = await readCatalogue(JSON.parse(productIds), tenant);
        setCatalogue(checked);
        setCatalogReload(value => value + 1);
        const affected = lines.filter(line => line.productId && (checked[line.productId]?.error || !checked[line.productId]?.product || catalogueLineIssue(line, checked[line.productId].product!, quantities[line.productId] ?? 0)));
        if (affected.length) { setError("Revisa los avisos de los productos señalados. La venta se conserva y todavía no se ha registrado ningún cobro."); return; }
      } finally { inFlight.current = false; setChecking(false); }
    }
    operationKey.current ??= crypto.randomUUID();
    operationBody.current ??= JSON.stringify({ userId: client?.id ?? null, petId: petId || null, paymentMethod, notes: notes.trim() || null, items: lines.map(line => ({ description: line.description.trim(), itemKind: line.itemKind, quantity: Number(line.quantity), unitPrice: moneyInCents(line.unitPrice)! / 100, ...(line.productId ? { productId:line.productId, priceVersion:line.priceVersion } : {}) })) });
    setCanRecover(true);
    if (!persist("verify")) { setError("No se pudo conservar la clave de esta venta. Habilita el almacenamiento del navegador antes de cobrar."); return; }
    inFlight.current = true; setSaving(true); setError("");
    let rejected = false;
    try {
      const response = await fetch(proxyUrl("/api/dashboard/transactions" + tenantQuery(tenant)), { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": operationKey.current }, body: operationBody.current });
      if (!response.ok) { const payload = await response.json().catch(() => null); rejected = response.status >= 400 && response.status < 500 && !["OPERATION_BUSY", "OPERATION_CONTENT_CHANGED"].includes(payload?.code) && !(retry && [401, 403].includes(response.status)); throw new Error(payload?.error ?? "No se pudo confirmar el cobro."); }
      const saved: Transaction = await response.json();
      if (!saved.id || !Array.isArray(saved.items)) throw new Error("Respuesta incompleta del servidor.");
      if (draftScope) { try { removeStoredDraft(sessionStorage, localStorage, draftScope); } catch { /* Confirmed response still takes precedence. */ } }
      setTransaction(saved);
    } catch (cause) {
      if (!rejected) { setUncertain(true); setError(cause instanceof Error ? cause.message + " Conservamos la venta para consultar el resultado o reintentar con la misma clave." : "Consulta el resultado o reintenta la misma venta."); }
      else {
        if (draftScope) { try { removeStoredDraft(sessionStorage, localStorage, draftScope); } catch { /* An explicit rejection authorizes a fresh intent. */ } }
        operationKey.current = null; operationBody.current = null;
        setCanRecover(false); setUncertain(false);
        setError(cause instanceof Error ? cause.message : "No se pudo registrar el cobro.");
        if (productIds !== "[]") {
          const checked = await readCatalogue(JSON.parse(productIds), tenant);
          setCatalogue(checked);
          setCatalogReload(value => value + 1);
        }
      }
    } finally { inFlight.current = false; setSaving(false); }
  }
  async function recover() {
    if (!operationKey.current || inFlight.current) return;
    inFlight.current = true; setSaving(true);
    try {
      const r=await fetch(proxyUrl(`/api/dashboard/pos/operations/${operationKey.current}${tenantQuery(tenant)}`),{cache:"no-store"}); const data=await r.json();
      if(!r.ok) throw new Error(data.error ?? "No hay un resultado confirmado todavía. Reintenta la misma venta.");
      if(!data.id || !Array.isArray(data.items)) throw new Error("Respuesta incompleta. Conservamos la venta para consultar de nuevo.");
      if(draftScope) { try { removeStoredDraft(sessionStorage, localStorage, draftScope); } catch { /* Confirmed result takes precedence. */ } } setTransaction(data);setError("");
    } catch(e){setError(e instanceof Error?e.message:"No se pudo consultar. Conservamos la clave de la venta.");}finally{inFlight.current=false;setSaving(false);}
  }
  if (!draftReady) return <p role="status" className="rounded-xl border bg-white p-6">Preparando la venta…</p>;
  if (transaction) return <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border bg-white">
    <div className="border-b bg-emerald-50 p-7 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-primary" /><h3 className="mt-3 text-2xl font-bold">Cobro registrado</h3><p className="mt-2 text-3xl font-bold tabular-nums text-primary">{formatPosMoney(transaction.total)}</p><p className="mt-2 text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[transaction.paymentMethod]} · {transaction.clientName || "Venta de mostrador"}</p>{paymentMethod === "cash" && change && <p className="mt-3 text-base font-semibold">Cambio para entregar: {formatPosMoney(change.change)}</p>}</div>
    <div className="space-y-5 p-6"><p className="break-all text-xs text-muted-foreground">Referencia guardada: {transaction.id}</p><div className="grid gap-3 sm:grid-cols-2"><Button size="lg" onClick={reset}><Plus className="mr-2 h-4 w-4" />Nuevo cobro</Button><Button size="lg" variant="outline" onClick={() => setReceiptOpen(true)}><ReceiptText className="mr-2 h-4 w-4" />Ver comprobante</Button></div><Link className="block text-center text-sm font-semibold text-primary underline underline-offset-4" href={cashHref}>Consultar movimientos de Caja</Link></div>
    <ReceiptDialog transaction={receiptOpen ? transaction : null} onClose={() => setReceiptOpen(false)} cash={paymentMethod === "cash" && change ? { received: moneyInCents(received)! / 100, change: change.change } : undefined} />
  </section>;
  return <>
    <p role="status" className="mb-3 text-xs text-muted-foreground">{draftNotice || (draftScope ? "La venta en preparación se conserva en esta pestaña durante 12 horas." : "")}</p>
    <form onSubmit={submit} onKeyDown={handleShortcuts} noValidate className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
      <fieldset disabled={locked} className="min-w-0 space-y-4 disabled:opacity-70">
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Cliente y mascota</h3></div>
              {client ? <button type="button" onClick={() => { setClient(null); setPetId(""); setGeneration(value => value + 1); }} className="min-h-9 rounded-lg border px-3 text-xs font-semibold hover:bg-muted">Venta de mostrador</button> : <span className="rounded-full bg-muted px-3 py-1 text-xs">Venta de mostrador</span>}
            </div>
            {!client ? <><ClientSearch key={generation} selected={client} onSelect={selected => { setClient(selected); setPetId(""); }} /><p className="mt-2 text-xs text-muted-foreground">Opcional: puedes cobrar sin registrar un cliente.{access?.capabilities.services ? " Elige una mascota para consultar su tarifa antes de agregar servicios." : ""}</p></> : <div className="rounded-xl bg-accent/50 p-3">
              <div className="flex items-start justify-between gap-3"><p className="min-w-0 flex-1 break-words text-sm"><strong>{client.name || "Sin nombre"}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{client.phone}</span></p><button type="button" onClick={() => { setClient(null); setPetId(""); setGeneration(value => value + 1); }} className="min-h-9 shrink-0 px-2 text-xs font-semibold text-primary underline">Cambiar cliente</button></div>
              {client.pets?.length > 0 ? <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Mascota:</span>{client.pets.map(pet => <button type="button" key={pet.id} aria-pressed={petId === pet.id} onClick={() => setPetId(previous => previous === pet.id ? "" : pet.id)} className={`min-h-9 rounded-lg border px-3 text-sm ${petId === pet.id ? "border-primary bg-primary text-white" : "bg-white"}`}>{getPetEmoji(pet.type)} {pet.name}</button>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Este cliente todavía no tiene mascotas registradas.</p>}
            </div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-0 pt-4 sm:px-5">
            <h3 className="text-sm font-semibold">Agregar a la venta</h3>
            {access?.capabilities.retail && access.capabilities.services && <div className="inline-flex rounded-xl bg-muted p-1" aria-label="Catálogo para la venta">
              <button type="button" aria-pressed={visibleCatalog === "products"} onClick={() => { setCatalogTab("products"); setSearchFocus(value => value + 1); }} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${visibleCatalog === "products" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}><Package className="h-4 w-4" />Productos</button>
              <button type="button" aria-pressed={visibleCatalog === "services"} onClick={() => { setCatalogTab("services"); setSearchFocus(value => value + 1); }} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${visibleCatalog === "services" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}><ShoppingBag className="h-4 w-4" />Servicios</button>
            </div>}
          </div>
          <div className="p-4 sm:p-5">
            {access?.capabilities.retail && visibleCatalog === "products" && <ProductPicker use="retail" hideUntilSearch resetAfterSelect inputId="pos-product-search" focusRequest={searchFocus} refreshRequest={catalogReload} quantities={quantities} onSelect={addProduct} />}
            {access?.capabilities.services && visibleCatalog === "services" && <ServiceCatalog key={`${tenant ?? "current"}:${access.activeModules.join(",")}:${petId}`} petId={petId} petName={selectedPet?.name} focusRequest={searchFocus} onAdd={addCartLine} />}
            <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Ingreso manual de un artículo</summary><div className="mt-2 flex flex-wrap gap-2">
              {access?.capabilities.retail && <Button type="button" variant="ghost" size="sm" onClick={() => addLine("product")}><Plus className="mr-1 h-3 w-3" />Producto manual · sin inventario</Button>}
              {access?.capabilities.services && <Button type="button" variant="ghost" size="sm" onClick={() => addLine("service")}><Plus className="mr-1 h-3 w-3" />Servicio manual</Button>}
            </div></details>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /><h3 className="font-semibold">Carrito</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{lines.length} {lines.length === 1 ? "artículo" : "artículos"}</span></div>
            {!!lines.length && <button type="button" onClick={() => setClearOpen(true)} className="flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" />Vaciar</button>}
          </div>
          {!lines.length ? <div className="px-5 py-8 text-center"><ShoppingBag className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-semibold">Tu carrito está vacío</p><p className="mt-1 text-sm text-muted-foreground">Selecciona un producto o servicio del catálogo de arriba.</p></div> :
          <ul className="divide-y">{lines.map((line, index) => {
            const product = line.productId ? catalogue[line.productId]?.product : undefined;
            const issue = lineIssues[line.id];
            const editing = !line.productId && (editingLineId === line.id || !line.description.trim() || !(moneyInCents(line.unitPrice)! > 0));
            const contextChanged = line.serviceQuote && line.serviceQuote.petId !== petId;
            const quantityValid = /^\d+$/.test(line.quantity) && Number(line.quantity) > 0 && Number(line.quantity) <= MAX_POS_QUANTITY;
            const atLimit = Number(line.quantity) >= MAX_POS_QUANTITY || !!(product && BigInt(quantities[product.id] ?? 0) >= BigInt(product.available));
            const issueId = `pos-line-issue-${line.id}`;
            return <li key={line.id} className={`px-4 py-3 sm:px-5 ${issue ? "bg-amber-50/60" : ""}`}>
              <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_126px_96px_32px]">
                <div className="min-w-0">
                  {line.productId ? <><p className="break-words text-sm font-semibold">{line.description}</p><p className="mt-1 break-words text-xs text-muted-foreground">{product?.internalCode ? `${product.internalCode} · ` : ""}{line.presentation}</p><p className="mt-1 text-xs text-muted-foreground">Unidad {formatPosMoney(Number(line.unitPrice))} · Precio del catálogo</p><p className="mt-1 text-xs font-medium text-primary">{product ? `${product.available} disponibles al consultar` : "Comprobando disponibilidad…"} · Descuenta inventario</p></> : editing ?
                  <div id={`pos-edit-${line.id}`} className="space-y-2"><label className="block text-xs font-medium">{line.itemKind === "service" ? "Servicio" : "Producto manual · sin inventario"}<Input autoFocus={!line.description.trim()} value={line.description} maxLength={250} onChange={event => setLine(line.id, "description", event.target.value)} aria-label={`Descripción del artículo ${index + 1}`} placeholder={line.itemKind === "service" ? "Ej. Corte de uñas" : "Ej. Artículo sin catálogo"} className="mt-1 bg-white" /></label><label className="block text-xs font-medium">Precio unitario (COP)<Input autoFocus={!!line.description.trim()} inputMode="decimal" value={line.unitPrice} onChange={event => setLine(line.id, "unitPrice", event.target.value)} aria-label={`Precio del artículo ${index + 1}`} placeholder="Ej. 55000" className="mt-1 bg-white tabular-nums" /></label><p className="text-xs text-muted-foreground">Escribe el valor sin puntos de miles. Los cambios se aplican a esta venta.</p><Button type="button" variant="outline" size="sm" disabled={!line.description.trim() || !(moneyInCents(line.unitPrice)! > 0)} onClick={() => setEditingLineId(null)}>Listo</Button></div> :
                  <><p className="break-words text-sm font-semibold">{line.description}</p><p className="mt-1 text-xs text-muted-foreground">Unidad {formatPosMoney(Number(line.unitPrice.replace(",", ".")))} · {checkoutPriceLabel(line)}</p>{line.itemKind === "product" && <p className="mt-1 text-xs text-muted-foreground">Producto manual · sin inventario</p>}<button type="button" aria-expanded={false} aria-controls={`pos-edit-${line.id}`} onClick={() => setEditingLineId(line.id)} className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-4"><Pencil className="h-3 w-3" />Editar artículo</button></>}
                </div>
                <div><label htmlFor={`pos-quantity-${line.id}`} className="mb-1.5 block text-xs font-medium">Cantidad</label><div className="flex items-center rounded-xl border bg-white"><button type="button" aria-label={`Quitar una unidad de ${line.description || `artículo ${index + 1}`}`} disabled={!quantityValid || Number(line.quantity) <= 1} onClick={() => changeQuantity(line, -1)} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-l-xl hover:bg-muted disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button><Input id={`pos-quantity-${line.id}`} inputMode="numeric" maxLength={10} value={line.quantity} onChange={event => setLine(line.id, "quantity", event.target.value)} aria-label={`Cantidad del artículo ${index + 1}`} aria-invalid={!!issue} aria-describedby={issue ? issueId : undefined} className="h-10 min-w-0 rounded-none border-x border-y-0 px-1 text-center shadow-none" /><button type="button" aria-label={`Agregar una unidad de ${line.description || `artículo ${index + 1}`}`} disabled={!quantityValid || atLimit} onClick={() => changeQuantity(line, 1)} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-r-xl hover:bg-muted disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button></div></div>
                <div className="text-left sm:text-right"><p className="text-xs text-muted-foreground">Subtotal</p><p className="mt-2 break-words text-sm font-bold tabular-nums">{formatPosMoney(lineTotalCents(line) / 100)}</p></div>
                <button type="button" aria-label={`Quitar artículo ${index + 1}`} className="flex h-9 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary" onClick={() => removeLine(line.id)}><Trash2 className="h-4 w-4" /></button>
              </div>
              {line.productId && <button type="button" className="mt-2 min-h-8 text-xs font-semibold text-primary underline underline-offset-4" onClick={() => void updateCatalogueLine(line)}>{updating === line.id ? "Actualizando…" : "Actualizar precio y disponibilidad"}</button>}
              {contextChanged && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">Este servicio se agregó {line.serviceQuote!.petId ? `para ${line.serviceQuote!.petName || "otra mascota"}` : "sin mascota seleccionada"}. Revisa el precio para {selectedPet?.name || "esta venta"}; puedes editarlo o volver a agregarlo desde el catálogo.</p>}
              {issue && <p id={issueId} role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{issue}</p>}
            </li>;
          })}</ul>}
          {cartNotice && <p role="status" className="border-t bg-accent/30 px-5 py-3 text-sm text-primary">{cartNotice}</p>}
          {access?.capabilities.services && <p className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">Las citas completadas ya generan un cobro. Revisa <Link className="font-semibold text-primary underline" href={cashHref}>Caja diaria</Link> antes de cobrar el mismo servicio otra vez.</p>}
        </section>
      </fieldset>

      <aside className="xl:sticky xl:top-28">
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="bg-[#1b353b] px-5 py-4 text-white"><p className="text-sm text-white/75">Total a cobrar · COP</p><p className="mt-1 break-words text-3xl font-bold tracking-tight tabular-nums" aria-live="polite">{formatPosMoney(totalCents / 100)}</p><p className="mt-2 text-xs text-white/75">{lines.length} {lines.length === 1 ? "artículo" : "artículos"} · {units} {units === 1 ? "unidad" : "unidades"}</p></div>
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Resumen de la venta</h3>
            <dl className="mt-2 space-y-1 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cliente</dt><dd className="min-w-0 break-words text-right font-medium">{client?.name || (client ? client.phone : "Venta de mostrador")}</dd></div>{client && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Mascota</dt><dd className="min-w-0 break-words text-right font-medium">{selectedPet?.name || "Sin seleccionar"}</dd></div>}</dl>
            {!!lines.length && <ul aria-label="Artículos del resumen de venta" className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t pt-3 text-xs">{lines.map(line => <li key={line.id} className="flex items-start justify-between gap-3"><span className="min-w-0 break-words"><strong className="font-medium">{line.description || "Artículo sin descripción"}</strong><span className="mt-0.5 block text-muted-foreground">Cantidad: {line.quantity || "—"}</span></span><span className="shrink-0 font-semibold tabular-nums">{formatPosMoney(lineTotalCents(line) / 100)}</span></li>)}</ul>}
          </div>
          <fieldset disabled={locked} className="space-y-4 p-5">
            <div><h3 className="mb-3 text-sm font-semibold">Método de pago</h3><div className="grid grid-cols-2 gap-2">{METHODS.map(({ value, icon: Icon }) => <button type="button" key={value} data-pos-payment aria-pressed={paymentMethod === value} onClick={() => { setPaymentMethod(value); setError(""); }} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${paymentMethod === value ? "border-primary bg-accent text-primary ring-1 ring-primary" : "hover:bg-muted"}`}><Icon className="h-4 w-4 shrink-0" />{PAYMENT_METHOD_LABELS[value]}</button>)}</div></div>
            {paymentMethod === "cash" ? <div className="space-y-3">
              <label htmlFor="pos-received" className="block text-sm font-semibold">Efectivo recibido (COP)</label><Input id="pos-received" inputMode="decimal" placeholder="Ej. 100000" value={received} onChange={event => { setReceived(event.target.value); setError(""); }} className="h-12 text-lg tabular-nums" />
              <Button type="button" variant="outline" className="w-full" disabled={!totalCents} onClick={() => { setReceived(String(totalCents / 100)); setError(""); }}>Recibí el valor exacto</Button>
              <div className="grid grid-cols-2 gap-2">{[20000, 50000, 100000, 200000].map(amount => <button type="button" key={amount} disabled={!totalCents || amount * 100 < totalCents} onClick={() => { setReceived(String(amount)); setError(""); }} className="min-h-10 rounded-lg border bg-background/50 text-sm font-medium tabular-nums hover:border-primary disabled:opacity-35" aria-label={`Recibí ${formatPosMoney(amount)}`}>{formatPosMoney(amount)}</button>)}</div>
              <p className="text-xs text-muted-foreground">Los importes rápidos reemplazan el efectivo recibido.</p>
              <div aria-live="polite" className={`rounded-xl border p-4 ${change?.missing ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}><p className="text-sm">{!change ? "Ingresa el efectivo para calcular el cambio" : change.missing ? "Falta por recibir" : "Cambio para entregar"}</p><strong className="mt-1 block text-2xl tabular-nums">{formatPosMoney(change?.missing || change?.change || 0)}</strong></div>
            </div> : null}
            {paymentMethod !== "cash" && <p className="rounded-xl bg-muted p-3 text-xs leading-relaxed">{paymentGuidance.hint}</p>}
            <label className="block text-sm font-medium">{paymentGuidance.label} <span className="font-normal text-muted-foreground">(opcional)</span><textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} placeholder={paymentGuidance.placeholder} rows={2} className="mt-2 block w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary" /></label>
          </fieldset>
          <div className="border-t px-5 pb-5 pt-4">
            {error && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p>{error}</p>{uncertain && <><Link className="mt-2 block font-semibold underline" href={cashHref}>Revisar Caja diaria</Link>{canRecover ? <span className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void recover()}>Consultar resultado</Button><Button type="button" size="sm" disabled={saving} onClick={() => void submit()}>Reintentar misma venta</Button></span> : <button type="button" className="mt-3 underline" onClick={() => setDiscardOpen(true)}>Ya revisé Caja: descartar preparación anterior</button>}</>}</div>}
            <Button ref={confirmButton} type="submit" size="lg" disabled={locked || !lines.length} className="h-13 w-full gap-2 text-base font-semibold">{saving || checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{checking ? "Comprobando productos…" : saving ? "Registrando cobro…" : "Confirmar cobro"}</Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Se verifica el stock al confirmar y se guarda el cobro con tu usuario.</p>
          </div>
        </section>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">Atajos dentro de la venta: <kbd className="rounded border bg-white px-1">F2</kbd> buscar · <kbd className="rounded border bg-white px-1">F4</kbd> pago · <kbd className="rounded border bg-white px-1">F8</kbd> ir a confirmar. Enter en el botón confirma el cobro.</p>
      </aside>
    </form>
    <Dialog open={discardOpen} onOpenChange={setDiscardOpen}><DialogContent className="border-border bg-white"><DialogHeader><DialogTitle>¿Ya verificaste este cobro?</DialogTitle><DialogDescription>Comprueba en Caja si la venta quedó registrada. Descartar esta preparación no anula ni elimina ningún cobro. Si se registró, evita cobrarla otra vez.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscardOpen(false)}>Volver a revisar</Button><Button onClick={() => { reset(); setDiscardOpen(false); }}>Verificado: empezar otra venta</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={clearOpen} onOpenChange={setClearOpen}><DialogContent className="border-border bg-white shadow-xl"><DialogHeader><DialogTitle>¿Vaciar esta venta?</DialogTitle><DialogDescription>Se quitarán los artículos que agregaste. Todavía no se ha registrado ningún cobro.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setClearOpen(false)}>Continuar venta</Button><Button variant="destructive" onClick={() => { setLines([]); setReceived(""); setError(""); setCartNotice(""); setClearOpen(false); }}>Vaciar artículos</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
