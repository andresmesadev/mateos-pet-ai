"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";
import { formatPosMoney, type CheckoutLine } from "@/lib/pos-checkout";

type Service = { id: string; name: string; category: string; price: number | null; priceSource: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function ServiceCatalog({ petId, petName = "", onAdd, focusRequest = 0 }: { petId: string; petName?: string; onAdd: (line: CheckoutLine) => boolean | void; focusRequest?: number }) {
  const tenant = useTenant();
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const resultsId = useId();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusRequest) input.current?.focus(); }, [focusRequest]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tenant) params.set("tenantId", tenant);
    if (petId) params.set("petId", petId);
    void fetch(proxyUrl(`/api/dashboard/cash/catalog?${params}`), { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("No se pudo cargar el catálogo."); return response.json(); })
      .then((rows: Service[]) => { if (!controller.signal.aborted) setServices(rows); })
      .catch(() => { if (!controller.signal.aborted) setError("No se pudo cargar el catálogo. Puedes ingresar un servicio manual."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tenant, petId, retry]);
  const filtered = services.filter(service => normalize(service.name).includes(normalize(query.trim())));
  const resultsVisible = browsing || !!query.trim();
  return <section className="space-y-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative block min-w-0 flex-1"><span className="sr-only">Buscar servicio del catálogo</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input ref={input} id="pos-service-search" value={query} onChange={event => { setQuery(event.target.value); setBrowsing(false); }} placeholder="Buscar servicio…" className="h-12 bg-white pl-9" /></label>
      <Button type="button" variant="outline" className="h-12 shrink-0" aria-expanded={resultsVisible} aria-controls={resultsId} onClick={() => { setQuery(""); setBrowsing(!resultsVisible); }}>{resultsVisible ? "Ocultar servicios" : "Ver servicios"}</Button>
    </div>
    {resultsVisible && <div id={resultsId}>{loading ? <p role="status" className="mt-3 flex gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Cargando servicios…</p> : error ? <div role="alert" className="mt-3 text-sm"><p>{error}</p><Button type="button" variant="outline" className="mt-2" onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}>Reintentar</Button></div> : <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
      {!filtered.length && <p className="py-2 text-sm text-muted-foreground">No hay servicios disponibles con esta búsqueda.</p>}
      {filtered.map(service => <button type="button" key={service.id} onClick={() => {
        const unitPrice = service.price !== null && service.price > 0 ? String(service.price) : "";
        const accepted = onAdd({ id: crypto.randomUUID(), description: service.name, quantity: "1", unitPrice, itemKind: "service", ...(unitPrice ? { serviceQuote: { source: ["pet_agreed_price", "pet_default_price"].includes(service.priceSource) ? "pet" as const : "catalog" as const, petId, petName, unitPrice, description: service.name } } : {}) });
        if (accepted !== false) { setQuery(""); setBrowsing(false); input.current?.focus(); }
      }} className="flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{service.name}</span><span className="text-xs text-muted-foreground">{service.category === "grooming" ? "Peluquería" : service.category === "veterinary" ? "Veterinaria" : "Otro servicio"}{service.priceSource === "pet_agreed_price" ? " · Tarifa acordada" : service.priceSource === "pet_default_price" ? " · Tarifa de la mascota" : ""}</span></span>
        <span className="text-sm tabular-nums">{service.price !== null && service.price > 0 ? formatPosMoney(service.price) : "Definir precio"}</span><Plus className="h-4 w-4 shrink-0 text-primary" />
      </button>)}
    </div>}</div>}
  </section>;
}
