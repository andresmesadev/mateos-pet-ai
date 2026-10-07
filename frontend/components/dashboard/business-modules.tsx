"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Info, Layers3, Save, Scissors, ShoppingBag, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { cn } from "@/lib/utils";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";

const MODULES = [
  { id: "veterinary", name: "Veterinaria", icon: Stethoscope, detail: "Consultas y cuidado de la salud de las mascotas.", features: ["Agenda veterinaria", "Consultas e historia clínica"], team: "Atención por administradores y veterinarios con acceso." },
  { id: "grooming", name: "Peluquería", icon: Scissors, detail: "Baños, cortes y cuidado del pelaje.", features: ["Agenda de peluquería", "Atenciones y notas de cada visita"], team: "Atención por administradores y peluqueros con acceso." },
  { id: "retail", name: "Pet shop", icon: ShoppingBag, detail: "Venta de productos del inventario.", features: ["Catálogo de productos en Punto de venta", "Stock actualizado al confirmar ventas"], team: "Venta por administradores, recepción y equipo autorizado para cobrar." },
] as const;

function sameSelection(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

type Props = { initial: string[]; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void };

export function BusinessModules({ initial, onDirtyChange, onSavingChange }: Props) {
  const [selected, setSelected] = useState(() => [...new Set(initial)]);
  const [saved, setSaved] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const savingRef = useRef(false);
  const tenant = useTenant();
  const router = useRouter();
  const access = useDashboardAccess();
  const dirty = !sameSelection(selected, saved);
  const added = MODULES.filter((area) => selected.includes(area.id) && !saved.includes(area.id));
  const removed = MODULES.filter((area) => !selected.includes(area.id) && saved.includes(area.id));
  const hasAppointments = selected.includes("veterinary") || selected.includes("grooming");
  const menuUpdated = !!access && sameSelection(saved, access.activeModules);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  function reset() {
    setSelected([...saved]);
    setError(null);
    setJustSaved(false);
  }

  async function save() {
    if (savingRef.current || !dirty || selected.length === 0) return;
    savingRef.current = true;
    setConfirming(false);
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const response = await fetch(proxyUrl("/api/dashboard/tenant/config" + tenantQuery(tenant)), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activeModules: selected }),
      });
      const payload = await response.json().catch(() => null) as { activeModules?: string[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "No se pudieron guardar las áreas. Intenta de nuevo.");
      const confirmed = payload?.activeModules;
      if (!Array.isArray(confirmed) || !confirmed.length || confirmed.some((id) => !MODULES.some((area) => area.id === id))) {
        throw new Error("No se pudo confirmar la configuración. Recarga y revisa las áreas antes de volver a guardar.");
      }
      setSelected([...new Set(confirmed)]);
      setSaved([...new Set(confirmed)]);
      setJustSaved(true);
      router.refresh();
      window.dispatchEvent(new Event("mateos-business-config-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las áreas.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="business-areas-title" aria-busy={saving}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6 sm:p-8">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-teal-50 p-3 text-primary"><Layers3 aria-hidden="true" className="h-5 w-5" /></div><div><h2 id="business-areas-title" className="text-xl font-bold">Áreas del negocio</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Selecciona lo que ofrece tu establecimiento. Puedes combinar las áreas según tu negocio.</p></div></div>
        <Badge variant="outline">{saved.length} {saved.length === 1 ? "área activa" : "áreas activas"}</Badge>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <fieldset disabled={saving} className="min-w-0">
          <legend className="mb-4 text-sm font-semibold">¿Qué servicios ofrece tu negocio?</legend>
          <div className="grid gap-4 md:grid-cols-3">
            {MODULES.map(({ id, name, icon: Icon, detail, features, team }) => {
              const checked = selected.includes(id);
              const configured = saved.includes(id);
              return (
                <label key={id} className={cn("relative flex cursor-pointer flex-col rounded-xl border p-5 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", checked ? "border-primary bg-teal-50/60" : "border-border bg-white hover:bg-muted/30", saving && "cursor-wait opacity-60")}>
                  <div className="flex items-center justify-between gap-3"><span className={cn("rounded-lg p-2", checked ? "bg-teal-100 text-primary" : "bg-muted text-muted-foreground")}><Icon aria-hidden="true" className="h-5 w-5" /></span><input type="checkbox" aria-label={name} aria-describedby={`area-detail-${id}`} checked={checked} onChange={(event) => { const checked = event.target.checked; setSelected((values) => checked ? [...values, id] : values.filter((value) => value !== id)); setError(null); setJustSaved(false); }} className="h-5 w-5 cursor-pointer accent-teal-700" /></div>
                  <span className="mt-4 text-base font-bold">{name}</span><span id={`area-detail-${id}`} className="mt-1 text-sm text-muted-foreground">{detail}</span>
                  <ul className="my-4 space-y-2">{features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul>
                  <span className="mt-auto border-t border-border/70 pt-3 text-xs text-muted-foreground">{team}</span>
                  <span className={cn("mt-3 text-xs font-semibold", checked !== configured ? "text-amber-800" : checked ? "text-primary" : "text-muted-foreground")}>{checked !== configured ? checked ? "Se activará al guardar" : "Se desactivará al guardar" : configured ? "Activa actualmente" : "No activa"}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-xl border border-border bg-muted/20 p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Info aria-hidden="true" className="h-4 w-4 text-primary" />Cómo queda tu espacio de trabajo</h3>
          <p className="mt-1 text-sm text-muted-foreground">{dirty ? "Vista previa de la selección. El menú cambia después de guardar." : "Configuración guardada para este establecimiento."}</p>
          <p className="mt-4 text-sm font-medium">{selected.length === 0 ? "Selecciona al menos un área para continuar." : `Áreas seleccionadas: ${MODULES.filter((area) => selected.includes(area.id)).map((area) => area.name).join(" · ")}.`}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>{hasAppointments ? "Agenda disponible para las áreas de atención seleccionadas." : "Sin Agenda, consultas ni peluquería: una tienda sola puede trabajar directamente desde Punto de venta."}</li>
            <li>{selected.includes("retail") ? "Venta de productos habilitada, además del cobro de los servicios que ofrezcas." : "Punto de venta disponible para cobrar servicios; la venta de productos requiere activar Pet shop."}</li>
            <li>El administrador mantiene Clientes y mascotas, WhatsApp, Inventario, Seguimiento de clientes y Administración.</li>
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Activar un área no concede permisos adicionales al equipo. Cada persona ve las opciones permitidas por su perfil y por las áreas activas. Los accesos se gestionan en Equipo y accesos.</p>
        </div>

        {dirty && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" aria-label="Cambios de áreas pendientes"><h3 className="font-semibold">Cambios al guardar</h3>{added.length > 0 && <p className="mt-2">Activar: {added.map((area) => area.name).join(", ")}.</p>}{removed.length > 0 && <><p className="mt-2">Desactivar: {removed.map((area) => area.name).join(", ")}.</p><p className="mt-2">Se bloquearán nuevas operaciones de esas áreas. Los registros existentes se conservan y puedes reactivar el área después.</p></>}</div>}
        {selected.length === 0 && <p role="alert" className="text-sm text-destructive">El negocio debe tener al menos un área activa. Marca una opción antes de guardar.</p>}
      </div>

      <div className="border-t border-border bg-muted/20 p-6 sm:px-8">
        {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{justSaved && <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />}{saving ? "Guardando las áreas…" : dirty ? "Tienes cambios sin guardar." : justSaved ? menuUpdated ? "Áreas guardadas. El menú se actualizó para tu perfil." : "Áreas guardadas. Actualizando las opciones disponibles…" : "No hay cambios pendientes."}</p>
          <div className="flex flex-wrap gap-2">{dirty && <Button variant="outline" disabled={saving} onClick={reset}>Descartar cambios</Button>}<Button disabled={saving || !dirty || selected.length === 0} onClick={() => { if (removed.length) setConfirming(true); else void save(); }}><Save aria-hidden="true" className="h-4 w-4" />{saving ? "Guardando…" : "Guardar áreas"}</Button></div>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader><DialogTitle>Confirmar cambios de áreas</DialogTitle><DialogDescription>Vas a desactivar {removed.map((area) => area.name).join(" y ")}. Las nuevas operaciones de esas áreas quedarán bloqueadas para el establecimiento y su equipo. Los registros existentes se conservan.</DialogDescription></DialogHeader>
          {added.length > 0 && <p className="text-sm">También se activará: {added.map((area) => area.name).join(", ")}.</p>}
          <p className="text-sm text-muted-foreground">Puedes volver a activar un área desde esta pantalla. Los cambios no eliminan las cuentas del equipo ni sus permisos configurados.</p>
          <DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Seguir revisando</Button><Button onClick={() => void save()}>Confirmar y guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
