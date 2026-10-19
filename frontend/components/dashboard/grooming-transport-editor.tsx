"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { transportLabels, transportPayload, type TransportDraft } from "@/lib/grooming-transport";
import { type TodayAppointment } from "@/lib/appointments";
import { GroomingTransportFields } from "./grooming-transport-fields";
import { useDashboardAccess } from "./dashboard-access-provider";
import { formatCOP } from "@/lib/transactions";

export function GroomingTransportEditor({ appointment, onUpdated, readOnly = false, onEditStateChange }: { appointment: TodayAppointment; onUpdated: (value: TodayAppointment) => void; readOnly?: boolean; onEditStateChange?: (state: { dirty: boolean; saving: boolean }) => void }) {
  const tenant = useTenant(); const access = useDashboardAccess();
  const current = appointment.transport;
  const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const initial: TransportDraft = { mode: current?.mode ?? "none", zoneId: current?.zoneId ?? "", address: current?.address ?? appointment.clientAddress ?? "", neighborhood: current?.mode && current.mode !== 'none' ? current.neighborhood ?? "" : appointment.clientNeighborhood ?? "", amount: !access?.capabilities.appointmentPrice || current?.price == null ? "" : String(current.price), confirmed: Boolean(access?.capabilities.appointmentPrice && current?.price != null && !current.pending), sharedWithId: current?.sharedWithId ?? "", scope: current?.scope ?? "" };
  const [value, setValue] = useState<TransportDraft>(initial);
  const dirty = editing && JSON.stringify(value) !== JSON.stringify(initial);
  useEffect(() => { onEditStateChange?.({ dirty, saving }); }, [dirty, saving, onEditStateChange]);
  useEffect(() => () => onEditStateChange?.({ dirty: false, saving: false }), [onEditStateChange]);
  const own = access?.role !== "groomer" || appointment.staffId === access.staffId;
  const canEdit = !readOnly && own && !["completed", "cancelled", "no_show"].includes(appointment.status) && (access?.capabilities.schedule || access?.capabilities.appointmentPrice);
  async function save() {
    if (saving) return; setSaving(true); setError("");
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/${appointment.id}/transport${tenantQuery(tenant)}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(transportPayload(value)) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudo guardar el domicilio.");
      if (body.id !== appointment.id || !body.transport) throw new Error("No se pudo confirmar el guardado. Actualiza la cita antes de volver a guardar.");
      setEditing(false); onUpdated(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el domicilio."); }
    finally { setSaving(false); }
  }
  return <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">Domicilio de peluquería</h3>
    {editing ? <><GroomingTransportFields value={value} onChange={setValue} petId={appointment.petId ?? ""} appointmentId={appointment.id} serviceId={appointment.serviceId} date={appointment.date} disabled={saving} /><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void save()} disabled={saving || !value.mode}>{saving ? "Guardando…" : "Guardar domicilio"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => { setValue(initial); setEditing(false); setError(""); }}>Cancelar</Button></div></> : <>
      <p className="text-sm">{transportLabels[current?.mode ?? "none"]}</p>
      <div className="text-sm"><p className="font-medium">Dirección</p><p className="break-words text-muted-foreground">{current?.address || appointment.clientAddress || "Sin dirección registrada en el cliente"}</p></div>
      {current?.mode !== "none" && <div className="text-sm"><p className="font-medium">Barrio</p><p className="break-words text-muted-foreground">{current?.neighborhood || "Sin barrio registrado"}</p></div>}
      {current && current.mode !== "none" && <p className="text-sm">{current.pending ? "Valor del domicilio por confirmar" : current.mode === "shared" ? "Domicilio cobrado en otra cita" : current.price == null ? "Valor reservado" : `Valor del domicilio: ${formatCOP(current.price)}`}</p>}
      {canEdit && <Button type="button" variant="outline" onClick={() => { setValue(initial); setEditing(true); }}>Configurar domicilio</Button>}
    </>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
