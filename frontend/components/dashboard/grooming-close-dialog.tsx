"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatService } from "@/lib/appointments";
import { type GroomingVisit } from "@/lib/grooming";
import { useDashboardAccess } from "./dashboard-access-provider";

export function GroomingCloseDialog({ visit, action, busy, error, onClose, onConfirm, onResolve }: {
  visit: GroomingVisit; action: "complete" | "delivery"; busy: boolean; error: string | null;
  onClose: () => void; onConfirm: () => void; onResolve: (field: "staff" | "price" | "notes") => void;
}) {
  const access = useDashboardAccess();
  const canSeePrice = Boolean(access?.capabilities.cash || access?.capabilities.appointmentPrice);
  const priced = visit.hasResolvedPrice ?? visit.finalPrice != null;
  const pending = [
    ...(!visit.staffId ? [{ field: "staff" as const, label: "Peluquero sin asignar", button: "Asignar peluquero" }] : []),
    ...(!priced ? [{ field: "price" as const, label: "Precio sin definir", button: "Colocar precio" }] : []),
    ...(!visit.groomingNotes?.trim() ? [{ field: "notes" as const, label: "Sin notas de esta visita (opcionales)", button: "Agregar notas" }] : []),
  ];
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent showClose={!busy} className="flex max-h-[90dvh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-xl">
      <DialogHeader className="shrink-0 pr-10"><DialogTitle>{action === "delivery" ? `Entrega de ${visit.petName}` : `Terminar el servicio de ${visit.petName}`}</DialogTitle><DialogDescription>{action === "delivery" ? "Revisa el servicio y los cuidados que debes explicar al propietario antes de confirmar la entrega." : "Revisa estos datos antes de cerrar la atención. La mascota quedará lista para entregar."}</DialogDescription></DialogHeader>
      <div className="space-y-5 overflow-y-auto px-6 py-5">
        <dl className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Mascota</dt><dd className="font-semibold">{visit.petName}</dd></div>
          <div><dt className="text-muted-foreground">Propietario</dt><dd className="break-words font-semibold">{visit.clientName || "Sin nombre registrado"}</dd></div>
          <div><dt className="text-muted-foreground">Servicio realizado</dt><dd className="font-semibold">{visit.serviceName ?? formatService(visit.serviceType)}</dd></div>
          <div><dt className="text-muted-foreground">Peluquero</dt><dd className="font-semibold">{visit.staffName || "Sin asignar"}</dd></div>
          {canSeePrice && <div className="sm:col-span-2"><dt className="text-muted-foreground">Precio del servicio</dt><dd className="text-lg font-bold">{visit.finalPrice == null ? "Sin definir" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(visit.finalPrice)}</dd></div>}
        </dl>
        {action === "complete" && pending.length > 0 && <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Datos por revisar antes del cierre"><h3 className="text-sm font-semibold text-amber-950">Por revisar</h3>{pending.map((item) => <div key={item.field} className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>{item.label}</p>{(item.field === "notes" || (item.field === "price" ? access?.capabilities.appointmentPrice : access?.capabilities.schedule)) ? <Button size="sm" variant="outline" className="min-h-11" disabled={busy} onClick={() => onResolve(item.field)}>{item.button}</Button> : <span className="text-xs font-medium">Solicita la revisión a recepción.</span>}</div>)}<p className="text-xs leading-relaxed text-amber-900">Las notas son opcionales. El precio debe estar definido para terminar el servicio.</p></section>}
        <section className="space-y-2" aria-label="Notas y cuidados para la entrega"><h3 className="text-sm font-semibold">Notas y cuidados de esta visita</h3><p className="whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-relaxed">{visit.groomingNotes || "No se registraron notas de esta visita."}</p></section>
        {action === "complete" && <p className="text-xs text-muted-foreground">Al terminar, la mascota queda lista para su entrega. {canSeePrice ? "El cobro se registra en Caja." : "Recepción puede revisar los datos de cobro."}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </div>
      <DialogFooter className="shrink-0 flex-col gap-2 border-t bg-white sm:flex-row"><Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={onClose}>Volver</Button><Button className="min-h-11 w-full sm:w-auto" disabled={busy || (action === "complete" && !priced)} onClick={onConfirm}>{busy ? "Guardando…" : action === "delivery" ? "Confirmar entrega al propietario" : "Terminar servicio"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
