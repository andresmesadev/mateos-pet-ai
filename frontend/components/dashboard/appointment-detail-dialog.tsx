"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, PawPrint, Stethoscope, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VetRecordSheet } from "@/components/dashboard/vet-record-sheet";
import { proxyUrl } from "@/lib/api";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import {
  formatColombiaDateTime,
  formatService,
  formatStatus,
  getStatusTransitions,
  arrivalWindowExpired,
  statusBadgeClass,
  type TodayAppointment,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

type Props = {
  appointment: TodayAppointment;
  onClose: () => void;
  onUpdated: (appointment: TodayAppointment) => void;
  readOnly?: boolean;
  startInPriceEdit?: boolean;
};

const VET_SERVICE_TYPES = ["vet", "consultation", "veterinary_consultation"];

export function AppointmentDetailDialog({ appointment, onClose, onUpdated, readOnly = false, startInPriceEdit = false }: Props) {
  const tenant = useTenant();
  const access = useDashboardAccess();
  const [busy, setBusy] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState(startInPriceEdit);
  const [price, setPrice] = useState(appointment.priceResolution?.manualOverride?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const graceExpired = ["pending", "confirmed"].includes(appointment.status) && arrivalWindowExpired(appointment.date);
  const previousDayArrival = appointment.status === "arrived" && new Date(appointment.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) < new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const own = access?.capabilities.administration || !appointment.staffId || appointment.staffId === access?.staffId;
  const transitions = getStatusTransitions(appointment.status).filter(t => access?.capabilities.administration || (access?.role === "receptionist" ? ["confirmed", "arrived", "cancelled", "no_show"].includes(t.next) : own && ["arrived", "in_progress", "completed"].includes(t.next))).filter((transition) => (!graceExpired || !["confirmed", "arrived"].includes(transition.next)) && (!previousDayArrival || transition.next !== "in_progress"));
  const canEditPrice = Boolean(access?.capabilities.appointmentPrice && own) && !readOnly && !["completed", "cancelled", "no_show"].includes(appointment.status);
  const canSavePetPrice = Boolean(access?.capabilities.administration && appointment.petId && appointment.serviceId);
  const canRecord = access?.capabilities.clinical && own && VET_SERVICE_TYPES.includes(appointment.serviceType?.toLowerCase()) &&
    (appointment.status === "in_progress" || appointment.status === "completed") && !!appointment.petId;

  async function updateStatus(nextStatus: string) {
    if (nextStatus === "in_progress" && previousDayArrival && !window.confirm("Esta llegada corresponde a un día anterior. ¿Confirmas que sí se prestó la atención y vas a completar su historia clínica?")) return;
    if (["cancelled", "no_show", "completed"].includes(nextStatus)) {
      const question = nextStatus === "completed"
        ? "¿Completar esta cita? Se registrarán el cobro y la comisión correspondientes."
        : nextStatus === "no_show"
          ? "¿Marcar esta cita como no asistida?"
          : "¿Cancelar esta cita? Esta acción no se puede deshacer.";
      if (!window.confirm(question)) return;
    }

    setBusy(true);
    setError(null);
    try {
      const complete = nextStatus === "completed";
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/${appointment.id}${complete ? "/complete" : ""}`), {
        method: complete ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complete ? {} : { status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Intenta de nuevo.");
      onUpdated(payload as TodayAppointment);
    } catch (cause) {
      setError(cause instanceof Error ? `No se pudo actualizar la cita. ${cause.message}` : "No se pudo actualizar la cita. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function savePrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(price);
    if (price.trim() === "" || !Number.isFinite(amount) || amount < 0 || amount > 99_999_999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      setError("Ingresa un precio válido en pesos colombianos.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const pricePath = canSavePetPrice ? `/api/dashboard/appointments/${appointment.id}/agreed-price` : `/api/dashboard/appointments/${appointment.id}`;
      const response = await fetch(proxyUrl(`${pricePath}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(canSavePetPrice ? { price: amount } : { finalPrice: amount }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Intenta de nuevo.");
      onUpdated(payload as TodayAppointment);
      setEditingPrice(false);
    } catch (cause) {
      setError(cause instanceof Error ? `No se pudo guardar el precio. ${cause.message}` : "No se pudo guardar el precio. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={!recordOpen} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
        <DialogContent className="max-h-[min(90vh,760px)] max-w-2xl overflow-y-auto border-slate-200 bg-white p-0 text-slate-900 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 bg-slate-50/70 px-6 py-6 pr-14 sm:px-8">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-2xl" aria-hidden="true">{getPetEmoji(appointment.petType)}</span>
              <Badge variant="outline" className={statusBadgeClass(appointment.status)}>{formatStatus(appointment.status)}</Badge>
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-950">Cita de {appointment.petName}</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">Datos y acciones de esta atención</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3"><CalendarDays className="mt-0.5 size-5 shrink-0 text-teal-700" /><div><dt className="text-xs font-medium text-slate-500">Fecha y hora</dt><dd className="font-semibold">{formatColombiaDateTime(appointment.date)}</dd></div></div>
              <div className="flex gap-3"><PawPrint className="mt-0.5 size-5 shrink-0 text-teal-700" /><div><dt className="text-xs font-medium text-slate-500">Servicio</dt><dd className="font-semibold">{appointment.serviceName ?? formatService(appointment.serviceType)}</dd></div></div>
              <div className="flex gap-3"><UserRound className="mt-0.5 size-5 shrink-0 text-teal-700" /><div><dt className="text-xs font-medium text-slate-500">Propietario</dt><dd className="font-semibold">{appointment.clientName ?? appointment.clientPhone ?? "Sin registrar"}</dd>{appointment.clientName && appointment.clientPhone && <dd className="text-sm text-slate-500">{appointment.clientPhone}</dd>}</div></div>
              <div className="flex gap-3"><Stethoscope className="mt-0.5 size-5 shrink-0 text-teal-700" /><div><dt className="text-xs font-medium text-slate-500">Profesional</dt><dd className="font-semibold">{appointment.staffName ?? "Sin asignar"}</dd></div></div>
              {(access?.capabilities.cash || access?.capabilities.appointmentPrice) && <div className="flex gap-3"><Clock3 className="mt-0.5 size-5 shrink-0 text-teal-700" /><div><dt className="text-xs font-medium text-slate-500">Precio de esta cita</dt><dd className="font-semibold">{appointment.finalPrice == null ? "Sin precio definido" : `$${appointment.finalPrice.toLocaleString("es-CO")}`}</dd>{canEditPrice && !editingPrice && <button type="button" onClick={() => { setPrice(appointment.priceResolution?.manualOverride?.toString() ?? appointment.finalPrice?.toString() ?? ""); setError(null); setEditingPrice(true); }} className="mt-1 text-sm font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950">{appointment.finalPrice == null ? "Definir precio" : "Cambiar precio"}</button>}</div></div>}
            </dl>

            {canEditPrice && editingPrice && <form onSubmit={savePrice} className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5">
              <h3 className="font-semibold text-slate-950">Precio para {appointment.petName}</h3>
              <p className="mt-1 text-sm text-slate-600">{canSavePetPrice
                ? `Se guardará para ${appointment.petName} en ${appointment.serviceName ?? formatService(appointment.serviceType)} y se usará en próximas citas del mismo servicio que no tengan precio fijado. También fija el precio de esta cita. Puedes editar la tarifa desde su ficha.`
                : "El valor se guardará solo para esta cita. Las tarifas del catálogo y de futuras visitas las administra el responsable del negocio."}</p>
              <label htmlFor="appointment-price" className="mt-4 block text-sm font-semibold text-slate-800">Valor de esta cita (COP)</label>
              <div className="mt-1 flex max-w-xs items-center overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-teal-600"><span className="px-3 text-slate-500" aria-hidden="true">$</span><input id="appointment-price" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" required autoFocus value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ej. 45000" className="min-h-11 w-full bg-transparent pr-3 text-slate-950 outline-none" /></div>
              <div className="mt-4 flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Guardar precio"}</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setEditingPrice(false); setError(null); }}>Cancelar</Button></div>
            </form>}

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            {graceExpired && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Pasaron 30 minutos sin llegada registrada. Esta cita se marcará automáticamente como “No asistió”.</p>}
            {previousDayArrival && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Esta cita figura como “Llegó” en un día anterior. Verifica si hubo atención antes de cerrarla.</p>}

            {!readOnly && (transitions.length > 0 || canRecord) && (
              <section className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4 sm:p-5" aria-label="Acciones de la cita">
                <h3 className="font-semibold text-slate-950">Siguiente paso</h3>
                <p className="mt-1 text-sm text-slate-600">Elige una acción según el estado de la cita.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {transitions.map((transition) => (
                    <Button key={transition.next} type="button" size="sm" variant={transition.variant ?? "default"} disabled={busy} onClick={() => updateStatus(transition.next)}>
                      {busy ? "Guardando…" : transition.label}
                    </Button>
                  ))}
                  {previousDayArrival && access?.capabilities.administration && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("in_progress")}>Regularizar atención anterior</Button>}
                  {canRecord && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setRecordOpen(true)}>Abrir historia clínica</Button>}
                </div>
              </section>
            )}

            {!readOnly && access?.capabilities.contacts && appointment.petId && <Link href={`/dashboard/pets?pet=${encodeURIComponent(appointment.petId)}`} onClick={onClose} className="inline-flex min-h-10 items-center text-sm font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950">Ver ficha de {appointment.petName}</Link>}
          </div>
        </DialogContent>
      </Dialog>
      {recordOpen && <VetRecordSheet appointment={appointment} open={recordOpen} onOpenChange={setRecordOpen} />}
    </>
  );
}
