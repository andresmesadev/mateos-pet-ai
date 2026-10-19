"use client";

import { useEffect, useRef, useState } from "react";
import { proxyUrl } from "@/lib/api";
import { useTenant, tenantQuery } from "@/lib/use-tenant";
import { useDashboardAccess } from "./dashboard-access-provider";
import { emptyTransport, transportLabels, transportPayload, type TransportDraft } from "@/lib/grooming-transport";
import { formatCOP } from "@/lib/transactions";

type Props = { value: TransportDraft; onChange: (value: TransportDraft) => void; petId: string; serviceId?: string | null; appointmentId?: string; date: string; disabled?: boolean };
type Quote = { servicePrice: number | null; transportReferencePrice: number | null; transportReferenceSource: string; agreedWithTransportTotal: number | null; transportPrice: number | null; totalPrice: number | null; quotedTotalPrice: number | null };

export function GroomingTransportFields({ value, onChange, petId, serviceId, appointmentId, date, disabled }: Props) {
  const tenant = useTenant(); const access = useDashboardAccess();
  const canPrice = Boolean(access?.capabilities.appointmentPrice);
  const initializedPrices = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ key: string; quote: Quote | null; candidates: { id: string; petName: string }[] } | null>(null);
  const payload = JSON.stringify({ petId, serviceId, appointmentId, date, transport: transportPayload(value) });
  const quote = result?.key === payload ? result.quote : null;
  const candidates = result?.candidates ?? [];
  const field = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
  const change = (patch: Partial<TransportDraft>) => onChange({ ...value, ...patch });
  const priceKey = `${petId}:${serviceId ?? ""}:${appointmentId ?? ""}:${value.mode}`;
  useEffect(() => {
    if (!value.mode || value.mode === "none" || !petId || (!appointmentId && !serviceId) || !date || (!value.address.trim() && value.mode !== "shared")) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(proxyUrl(`/api/dashboard/grooming/transport/quote${tenantQuery(tenant)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: controller.signal }).then(async response => {
        const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudo consultar el domicilio.");
        return body as { quote: Quote | null; sharedCandidates: { id: string; petName: string }[] };
      }).then(body => { if (!controller.signal.aborted) {
        setResult({ key: payload, quote: body.quote, candidates: body.sharedCandidates }); setError("");
        if (canPrice && value.mode !== "shared" && !initializedPrices.current.has(priceKey)) {
          initializedPrices.current.add(priceKey);
          if (!value.amount.trim() && body.quote?.transportReferencePrice != null) onChange({ ...value, amount: String(body.quote.transportReferencePrice), confirmed: true });
        }
      } }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [payload, tenant, value, petId, serviceId, appointmentId, date, onChange, canPrice, priceKey]);

  return <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
    <legend className="px-1 text-sm font-semibold">Llegada y domicilio</legend>
    <label className="block space-y-1 text-sm"><span>¿La traen al centro o necesita domicilio?</span><select required value={value.mode} onChange={event => { initializedPrices.current.clear(); onChange({ ...emptyTransport, mode: event.target.value, address: value.address, neighborhood: value.neighborhood, zoneId: value.zoneId, scope: value.scope }); }} className={field}><option value="">Seleccionar modalidad</option>{Object.entries(transportLabels).filter(([key]) => key !== "shared" || canPrice).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {value.mode && value.mode !== "none" && <>
      {value.mode === "shared" ? <label className="block space-y-1 text-sm"><span>Cita que cobra el domicilio</span><select required className={field} value={value.sharedWithId} onChange={event => change({ sharedWithId: event.target.value, confirmed: true })}><option value="">Seleccionar otra cita del mismo día</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.petName}</option>)}</select><span className="block text-xs text-muted-foreground">Solo aparecen citas del mismo propietario con transporte confirmado. El traslado se cobra una sola vez.</span></label> : <>
        <label className="block space-y-1 text-sm"><span>Dirección confirmada</span><input required maxLength={500} className={field} value={value.address} onChange={event => change({ address: event.target.value })} /></label>
        <label className="block space-y-1 text-sm"><span>Barrio</span><input maxLength={200} className={field} value={value.neighborhood} onChange={event => change({ neighborhood: event.target.value })} placeholder="Ej. Robledo Miramar" /></label>
        {canPrice && <>
          {quote && <div className="rounded-lg bg-white p-3 text-sm"><p>Peluquería: <strong>{quote.servicePrice == null ? "Pendiente" : formatCOP(quote.servicePrice)}</strong></p><p>Referencia de transporte: <strong>{quote.transportReferencePrice == null ? "Por confirmar" : formatCOP(quote.transportReferencePrice)}</strong>{quote.transportReferenceSource === "pet_agreement" ? " · acuerdo de la mascota" : quote.transportReferenceSource === "zone" ? " · zona" : ""}</p>{quote.agreedWithTransportTotal != null && <p>Total pactado con recogida y entrega: <strong>{formatCOP(quote.agreedWithTransportTotal)}</strong></p>}<p>Total de esta atención: <strong>{quote.totalPrice == null ? "Pendiente de confirmación" : formatCOP(quote.totalPrice)}</strong></p></div>}
          <label className="block space-y-1 text-sm"><span>Valor del domicilio (COP)</span><input type="number" min="0" max="99999999.99" step="0.01" className={field} value={value.amount} onChange={event => { initializedPrices.current.add(priceKey); change({ amount: event.target.value, confirmed: Boolean(event.target.value.trim()) }); }} placeholder="Por confirmar" /></label>
        </>}
      </>}
      <p className="text-xs text-muted-foreground">Guardar domicilio aplica el valor indicado. Vacío: por confirmar. 0: gratuito. La hora de cita no garantiza una hora de recogida.</p>
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </fieldset>;
}
