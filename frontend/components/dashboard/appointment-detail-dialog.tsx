"use client";

import { useActionConfirmation } from "@/components/dashboard/action-confirmation";
import { useGroomerSelection } from './use-groomer-selection';

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedDialog, useDialogEditGuard } from "@/components/dashboard/protected-dialog";

import { CaseSummary } from "@/components/dashboard/case-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VetRecordSheet } from "@/components/dashboard/vet-record-sheet";
import { proxyUrl } from "@/lib/api";
import { dashboardRequest } from "@/lib/dashboard-request";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { homeHref } from "@/lib/home-workspace";
import {
  formatService,
  formatColombiaDateTime,
  formatStatus,
  getStatusTransitions,
  arrivalWindowExpired,
  statusBadgeClass,
  isGroomingAppointment,
  type TodayAppointment,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";
import { GroomingTransportEditor } from "./grooming-transport-editor";
import { AppointmentPaymentLink } from './appointment-payment-link';

type Props = {
  appointment: TodayAppointment;
  onClose: () => void;
  onUpdated: (appointment: TodayAppointment) => void;
  readOnly?: boolean;
  startInPriceEdit?: boolean;
  onDeleted?: (id: string) => void;
};

const VET_SERVICE_TYPES = ["vet", "consultation", "veterinary_consultation"];

function AppointmentDetailContent({ appointment, onClose, onUpdated, onDeleted, readOnly = false, startInPriceEdit = false }: Props) {
  const { confirm, confirmation } = useActionConfirmation();
  const tenant = useTenant();
  const router = useRouter();
  const access = useDashboardAccess();
  const [busy, setBusy] = useState(false);
  const priceBusy = useRef(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState(startInPriceEdit);
  const servicePrice = appointment.priceResolution?.servicePrice ?? appointment.finalPrice;
  const [price, setPrice] = useState(appointment.priceResolution?.manualOverride?.toString() ?? servicePrice?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const removalBusy = useRef(false);
  const [transportEdit, setTransportEdit] = useState({ dirty: false, saving: false });
  const discard = useDialogEditGuard(!!removalReason.trim() || transportEdit.dirty || (editingPrice && price !== (appointment.priceResolution?.manualOverride?.toString() ?? servicePrice?.toString() ?? "")), busy || transportEdit.saving);
  const canRemove = !!onDeleted && !readOnly && access?.capabilities.schedule && !appointment.payment && !appointment.hasMedicalRecord && !appointment.endedAt && ['pending', 'confirmed', 'arrived', 'in_progress', 'cancelled', 'no_show'].includes(appointment.status);
  const graceExpired = ["pending", "confirmed"].includes(appointment.status) && arrivalWindowExpired(appointment.date);
  const previousDayArrival = appointment.status === "arrived" && new Date(appointment.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) < new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const own = access?.capabilities.administration || !appointment.staffId || appointment.staffId === access?.staffId;
  const transitions = getStatusTransitions(appointment.status).filter(t => access?.capabilities.administration || (access?.role === "receptionist" ? ["confirmed", "arrived", "cancelled", "no_show"].includes(t.next) : own && ["arrived", "in_progress", "completed"].includes(t.next))).filter((transition) => (!graceExpired || !["confirmed", "arrived"].includes(transition.next)) && (!previousDayArrival || transition.next !== "in_progress"));
  const canEditPrice = isGroomingAppointment(appointment) && Boolean(access?.capabilities.appointmentPrice && own) && !readOnly && !["completed", "cancelled", "no_show"].includes(appointment.status);
  const groomingPrice = appointment.serviceCategory === 'grooming' || appointment.serviceType === 'grooming';
  const canSavePetPrice = Boolean(access?.capabilities.administration && appointment.petId && appointment.serviceId && !groomingPrice && (!appointment.transport || appointment.transport.mode === 'none'));
  const canRecord = access?.capabilities.clinical && own && VET_SERVICE_TYPES.includes(appointment.serviceType?.toLowerCase()) &&
    (appointment.status === "in_progress" || appointment.status === "completed") && !!appointment.petId;

  const groomerSelection = useGroomerSelection(onUpdated);
  async function removeAppointment() {
    if (!canRemove || removalBusy.current || busy || !removalReason.trim()) return;
    if (!await confirm({ title: 'Eliminar cita creada por error', description: `${appointment.petName} · ${appointment.serviceName || formatService(appointment.serviceType)} · ${formatColombiaDateTime(appointment.date)}. Se retirará de Agenda y se conservará el motivo en auditoría. Esta acción no registra ni anula pagos.`, confirmLabel: 'Eliminar esta cita', destructive: true })) return;
    removalBusy.current = true; setBusy(true); setError(null);
    try {
      const { response, payload } = await dashboardRequest(proxyUrl(`/api/dashboard/appointments/${appointment.id}${tenantQuery(tenant)}`), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: removalReason.trim() }) });
      if (!response.ok) throw new Error(payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string' ? payload.error : 'Actualiza Agenda antes de reintentar.');
      if (!payload || typeof payload !== 'object' || !('removed' in payload) || payload.removed !== true || !('id' in payload) || payload.id !== appointment.id) throw new Error('La respuesta no confirma la eliminación. Actualiza Agenda antes de reintentar.');
      onDeleted?.(appointment.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la cita.'); }
    finally { removalBusy.current = false; setBusy(false); }
  }
  async function updateStatus(nextStatus: string, skipConfirmation = false) {
    if (!skipConfirmation && nextStatus === "in_progress" && previousDayArrival && !await confirm("Esta llegada corresponde a un día anterior. ¿Confirmas que sí se prestó la atención y vas a completar su historia clínica?")) return;
    if (!skipConfirmation && ["cancelled", "no_show", "completed"].includes(nextStatus)) {
      const question = nextStatus === "completed"
        ? `¿Finalizar esta atención? El cobro quedará pendiente hasta confirmar el pago en Caja.${appointment.serviceCategory === "grooming" || appointment.serviceType === "grooming" ? " La entrega física se registra por separado en Peluquería." : ""}`
        : nextStatus === "no_show"
          ? "¿Marcar esta cita como no asistida?"
          : "¿Cancelar esta cita? Esta acción no se puede deshacer.";
      if (!await confirm(question)) return;
    }

    setBusy(true);
    setError(null);
    try {
      const complete = nextStatus === "completed";
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/${appointment.id}${complete ? "/complete" : ""}${tenantQuery(tenant)}`), {
        method: complete ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complete ? {} : { status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok && groomerSelection.ask(appointment, payload, () => void updateStatus(nextStatus, true))) return;
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
    if (priceBusy.current || busy) return;
    const amount = Number(price);
    if (price.trim() === "" || !Number.isFinite(amount) || amount < 0 || amount > 99_999_999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      setError("Ingresa un precio válido en pesos colombianos.");
      return;
    }

    priceBusy.current = true; setBusy(true);
    setError(null);
    try {
      const pricePath = canSavePetPrice ? `/api/dashboard/appointments/${appointment.id}/agreed-price` : `/api/dashboard/appointments/${appointment.id}`;
      const { response, payload } = await dashboardRequest(proxyUrl(`${pricePath}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(canSavePetPrice ? { price: amount } : { finalPrice: amount }),
      });
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Comprueba el precio guardado antes de volver a intentarlo.");
      if (!payload || typeof payload !== "object" || !("id" in payload) || payload.id !== appointment.id || !("date" in payload) || typeof payload.date !== "string" || !Number.isFinite(Date.parse(payload.date)) || !("status" in payload) || typeof payload.status !== "string" || !("priceResolution" in payload) || !payload.priceResolution || typeof payload.priceResolution !== "object" || !("servicePrice" in payload.priceResolution) || typeof payload.priceResolution.servicePrice !== "number" || Math.round(payload.priceResolution.servicePrice * 100) !== Math.round(amount * 100)) throw new Error("La respuesta no confirma el precio. Conservamos tu valor; actualiza la cita para comprobar el guardado.");
      onUpdated(payload as TodayAppointment);
      if (groomingPrice && appointment.petId) window.dispatchEvent(new CustomEvent('pet-grooming-updated', { detail: { petId: appointment.petId } }));
      setEditingPrice(false);
    } catch (cause) {
      setError(cause instanceof Error ? `No se pudo guardar el precio. ${cause.message}` : "No se pudo guardar el precio. Intenta de nuevo.");
    } finally {
      priceBusy.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      {confirmation}
      {groomerSelection.dialog}
      {!recordOpen && (
        <DialogContent data-appointment-detail className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden border-border bg-white p-0 text-foreground shadow-xl">
          <DialogHeader className="shrink-0 border-border bg-white px-4 py-4 pr-14 text-left sm:px-6 sm:pr-14">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/60 text-2xl" aria-hidden="true">{getPetEmoji(appointment.petType)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><DialogTitle className="min-w-0 break-words text-xl font-bold tracking-tight sm:text-2xl">Cita de {appointment.petName}</DialogTitle><Badge variant="outline" className={`shrink-0 ${statusBadgeClass(appointment.status)}`}>{formatStatus(appointment.status)}</Badge></div>
                <DialogDescription className="mt-1 break-words text-sm text-muted-foreground">{appointment.serviceName || formatService(appointment.serviceType)}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div data-appointment-body className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-background/70 px-4 py-4 sm:px-6 sm:py-5">
            <div className={`grid items-start gap-4 ${appointment.serviceCategory === "grooming" || appointment.serviceType === "grooming" ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : ""}`}>
              <CaseSummary appointment={appointment} showPrice compact actions={canEditPrice && !editingPrice && <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => { setPrice(appointment.priceResolution?.manualOverride?.toString() ?? servicePrice?.toString() ?? ""); setError(null); setEditingPrice(true); }}>{appointment.finalPrice == null ? "Definir precio" : "Cambiar precio"}</Button>} />
              {(appointment.serviceCategory === "grooming" || appointment.serviceType === "grooming") && <GroomingTransportEditor key={`${appointment.id}:${JSON.stringify(appointment.transport)}`} appointment={appointment} onUpdated={onUpdated} readOnly={readOnly} onEditStateChange={setTransportEdit} />}
            </div>

            {canEditPrice && editingPrice && <form onSubmit={savePrice} className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5">
              <h3 className="font-semibold text-slate-950">Precio para {appointment.petName}</h3>
              <p className="mt-1 text-sm text-slate-600">{groomingPrice && appointment.petId
                ? `Al guardar se actualizarán esta cita y el valor habitual de peluquería en el expediente de ${appointment.petName}. Los cobros anteriores conservan sus importes.`
                : canSavePetPrice
                ? `Se guardará para ${appointment.petName} en ${appointment.serviceName ?? formatService(appointment.serviceType)} y se usará en próximas citas del mismo servicio que no tengan precio fijado. También fija el precio de esta cita. Puedes editar la tarifa desde su ficha.`
                : "El valor se guardará solo para esta cita. Las tarifas del catálogo y de futuras visitas las administra el responsable del negocio."}</p>
              <label htmlFor="appointment-price" className="mt-4 block text-sm font-semibold text-slate-800">Valor de esta cita (COP)</label>
              <div className="mt-1 flex max-w-xs items-center overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-teal-600"><span className="px-3 text-slate-500" aria-hidden="true">$</span><input id="appointment-price" disabled={busy} type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" required autoFocus value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ej. 45000" className="min-h-11 w-full bg-transparent pr-3 text-slate-950 outline-none disabled:opacity-60" /></div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"><Button type="submit" className="min-h-11" disabled={busy}>{busy ? "Guardando…" : "Guardar precio"}</Button><Button type="button" className="min-h-11" variant="outline" disabled={busy} onClick={() => { setEditingPrice(false); setError(null); }}>Cancelar</Button></div>
            </form>}

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            {canRemove && <section className="rounded-2xl border border-border bg-white p-4">
              {!removing ? <Button type="button" variant="ghost" className="min-h-11 text-destructive" disabled={busy || transportEdit.saving} onClick={() => discard(() => { setRemoving(true); setError(null); })}>Eliminar cita</Button> : <div className="space-y-3">
                <h3 className="font-semibold">Cita creada por error</h3><p className="text-sm text-muted-foreground">Solo se elimina si no tiene historia, cobros, comisiones ni otros registros asociados.</p>
                <label htmlFor="appointment-removal-reason" className="block text-sm font-semibold">Motivo de la eliminación</label><textarea id="appointment-removal-reason" autoFocus maxLength={500} disabled={busy} value={removalReason} onChange={event => setRemovalReason(event.target.value)} placeholder="Ej. Cita duplicada o mascota seleccionada por error" className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm" />
                <Button type="button" className="min-h-11" variant="outline" disabled={busy} onClick={() => { setRemoving(false); setRemovalReason(''); }}>Volver a la ficha</Button>
              </div>}
            </section>}
            {graceExpired && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Pasaron 30 minutos sin llegada registrada. Esta cita se marcará automáticamente como “No asistió”.</p>}
            {previousDayArrival && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Esta cita figura como “Llegó” en un día anterior. Verifica si hubo atención antes de cerrarla.</p>}

            {!readOnly && access?.capabilities.contacts && appointment.petId && <Link prefetch={false} href={homeHref(`/dashboard/contacto?view=mascotas&pet=${encodeURIComponent(appointment.petId)}`, tenant)} onClick={event => { event.preventDefault(); discard(() => { onClose(); router.push(homeHref(`/dashboard/contacto?view=mascotas&pet=${encodeURIComponent(appointment.petId!)}`, tenant)); }); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 hover:text-foreground">Ver ficha de {appointment.petName}</Link>}
          </div>
          <DialogFooter className="max-h-[40dvh] shrink-0 flex-col items-stretch gap-3 overflow-y-auto border-border bg-white px-4 py-4 sm:flex-row sm:items-end sm:px-6">
            {!readOnly && !removing && (transitions.length > 0 || canRecord) && (
              <section className="min-w-0 flex-1" aria-label="Acciones de la cita">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Siguiente paso</h3>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>button:only-child]:col-span-2 [&_button]:min-h-11 [&_button]:min-w-0 [&_button]:whitespace-normal sm:[&_button]:flex-1">
                  {transitions.map((transition) => (
                    <Button key={transition.next} type="button" variant={transition.variant ?? "default"} disabled={busy} onClick={() => updateStatus(transition.next)}>
                      {busy ? "Guardando…" : transition.label}
                    </Button>
                  ))}
                  {previousDayArrival && access?.capabilities.administration && <Button type="button" variant="outline" disabled={busy} onClick={() => updateStatus("in_progress")}>Regularizar atención anterior</Button>}
                  {canRecord && <Button type="button" variant="outline" disabled={busy} onClick={() => setRecordOpen(true)}>Abrir historia clínica</Button>}
                </div>
              </section>
            )}

            <div className={`flex flex-wrap items-center justify-between gap-2 [&_a]:min-h-11 ${!readOnly && !removing && (transitions.length > 0 || canRecord) ? "sm:shrink-0" : "w-full"}`}>{removing ? <Button type="button" className="min-h-11 whitespace-normal" variant="destructive" disabled={busy || !removalReason.trim()} onClick={() => void removeAppointment()}>{busy ? 'Eliminando…' : 'Eliminar cita creada por error'}</Button> : <AppointmentPaymentLink appointment={appointment} />}<Button type="button" variant="outline" className="min-h-11 flex-1 sm:ml-auto sm:flex-none" disabled={busy || transportEdit.saving} onClick={() => discard(onClose)}>Cerrar ficha</Button></div>
          </DialogFooter>
        </DialogContent>
      )}
      {recordOpen && <VetRecordSheet appointment={appointment} open={recordOpen} onOpenChange={setRecordOpen} />}
    </>
  );
}

export function AppointmentDetailDialog(props: Props) {
  return <ProtectedDialog open onOpenChange={open => { if (!open) props.onClose(); }}><AppointmentDetailContent {...props} /></ProtectedDialog>;
}
