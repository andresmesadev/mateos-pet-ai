"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";

export type PendingInventoryOperation = { key: string; kind: string; path: string; method: "POST" | "PATCH"; body: string; label: string; createdAt: number };
const PREFIX = "mateos-inventory-pending-v1:";
function storedPending(scope: string | null) {
  if (!scope) return [];
  const key = PREFIX + scope;
  const durable = readInventoryPending(localStorage.getItem(key));
  const legacy = readInventoryPending(sessionStorage.getItem(key));
  if (legacy.length) {
    const merged = [...durable, ...legacy.filter(p => !durable.some(d => d.key === p.key))];
    localStorage.setItem(key, JSON.stringify(merged));
    sessionStorage.removeItem(key);
    return merged;
  }
  return durable;
}
export function readInventoryPending(raw: string | null): PendingInventoryOperation[] {
  if (!raw || raw.length > 1000000) return [];
  try { const list: unknown = JSON.parse(raw); return Array.isArray(list) ? list.filter((p): p is PendingInventoryOperation => p && /^[a-f0-9-]{36}$/i.test(p.key) && typeof p.kind === "string" && typeof p.path === "string" && /^\/api\/dashboard\/(inventory\/|transactions\/)/.test(p.path) && ["POST", "PATCH"].includes(p.method) && typeof p.body === "string" && p.body.length <= 100000 && typeof p.label === "string" && Number.isFinite(p.createdAt)) : []; } catch { return []; }
}
export function useInventoryOperation(onConfirmed?: (operation: PendingInventoryOperation) => void | Promise<void>, onPrepared?: (operation: PendingInventoryOperation) => void) {
  const tenant = useTenant();
  const [scope, setScope] = useState<string | null>(null), [pending, setPending] = useState<PendingInventoryOperation[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const flight = useRef(false);
  const scoped = useCallback((path: string) => path + (tenant ? (path.includes("?") ? "&" : "?") + "tenantId=" + encodeURIComponent(tenant) : ""), [tenant]);
  useEffect(() => {
    const abort = new AbortController();
    fetch(proxyUrl(scoped("/api/dashboard/inventory/context")), { cache: "no-store", signal: abort.signal }).then(async r => {
      if (!r.ok) throw new Error("No se pudo comprobar la cuenta para guardar operaciones. Actualiza la página.");
      const data = await r.json(); if (!data.scope) throw new Error("Cuenta no disponible.");
      const stored = storedPending(data.scope);
      if (!abort.signal.aborted) { setScope(data.scope); setPending(stored); }
    }).catch(e => { if (!abort.signal.aborted) setMessage(e instanceof Error ? e.message : "Recuperación no disponible."); });
    return () => abort.abort();
  }, [scoped]);
  useEffect(() => {
    if (!scope) return;
    const refresh = () => { try { setPending(storedPending(scope)); } catch { setMessage("No se pudo consultar el almacenamiento de operaciones pendientes."); } };
    window.addEventListener("mateos-inventory-pending", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("mateos-inventory-pending", refresh); window.removeEventListener("storage", refresh); };
  }, [scope]);
  function store(list: PendingInventoryOperation[]) {
    if (!scope) throw new Error("Espera a que se compruebe tu cuenta.");
    localStorage.setItem(PREFIX + scope, JSON.stringify(list)); setPending(list);
    window.dispatchEvent(new Event("mateos-inventory-pending"));
  }
  async function request(p: PendingInventoryOperation, recover: boolean, retry = false) {
    if (flight.current) return false;
    flight.current = true; setBusy(true); setMessage("");
    let definitive = false;
    try {
      const path = recover ? `/api/dashboard/inventory/operations/${p.key}?kind=${encodeURIComponent(p.kind)}` : p.path;
      const response = await fetch(proxyUrl(scoped(path)), recover ? { cache: "no-store" } : { method: p.method, headers: { "Content-Type":"application/json", "Idempotency-Key":p.key }, body:p.body });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        definitive = !recover && response.status >= 400 && response.status < 500 && !["OPERATION_BUSY", "OPERATION_CONTENT_CHANGED"].includes(result?.code) && !(retry && [401, 403].includes(response.status));
        throw new Error(result?.error ?? "No se pudo comprobar el resultado. Consulta o reintenta la misma operación.");
      }
      store(storedPending(scope).filter(x => x.key !== p.key));
      setMessage("Operación guardada. Las existencias están actualizadas.");
      try { await onConfirmed?.(p); } catch { setMessage("Operación guardada. Actualiza la vista para consultar las existencias."); }
      return true;
    } catch (e) {
      if (definitive) store(storedPending(scope).filter(x => x.key !== p.key));
      setMessage(e instanceof Error ? e.message : "No se pudo comprobar el resultado. Conservamos la operación para consultarla."); return false;
    } finally { flight.current = false; setBusy(false); }
  }
  async function execute(kind: string, path: string, body: unknown, label: string, method: "POST" | "PATCH" = "POST") {
    if (flight.current) return false;
    let existing: PendingInventoryOperation[];
    try { existing = storedPending(scope); } catch { setMessage("No se pudo consultar el almacenamiento. Habilítalo antes de guardar."); return false; }
    if (existing.length) { setPending(existing); setMessage("Resuelve primero la operación pendiente: consulta su resultado o reinténtala."); return false; }
    const p = { key:crypto.randomUUID(), kind, path, method, body:JSON.stringify(body), label, createdAt:Date.now() };
    try { store([p]); } catch { setMessage("No se pudo conservar la clave en el navegador. Habilita el almacenamiento antes de guardar."); return false; }
    onPrepared?.(p);
    // The new request is durably saved before any network mutation.
    return request(p, false);
  }
  return { execute, pending, busy, message, ready:!!scope, recover:(p:PendingInventoryOperation)=>request(p,true), retry:(p:PendingInventoryOperation)=>request(p,false,true) };
}
