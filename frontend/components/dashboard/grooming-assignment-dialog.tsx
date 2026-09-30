"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { type GroomingVisit } from "@/lib/grooming";

export function GroomingAssignmentDialog({ visit, staff, tenantId, onClose, onSaved }: {
  visit: GroomingVisit; staff: { id: string; name: string }[]; tenantId?: string;
  onClose: () => void; onSaved: (visit: GroomingVisit) => void;
}) {
  const [staffId, setStaffId] = useState(visit.staffId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/${encodeURIComponent(visit.id)}?${params}`), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId }),
      });
      const payload = await response.json() as Partial<GroomingVisit> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo asignar el peluquero.");
      onSaved({ ...visit, ...payload });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Intenta de nuevo."); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent showClose={!saving}>
    <DialogHeader><DialogTitle>Peluquero de {visit.petName}</DialogTitle><DialogDescription>Elige quién realizará este baño o corte.</DialogDescription></DialogHeader>
    <div className="space-y-3 px-6 py-4"><label htmlFor="assign-groomer" className="block text-sm font-semibold">Peluquero responsable</label>
    <select id="assign-groomer" value={staffId} disabled={saving} onChange={(event) => setStaffId(event.target.value)} className="min-h-11 w-full rounded-lg border bg-white px-3 text-sm"><option value="">Selecciona un peluquero</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {!staff.length && <p role="status" className="text-sm text-amber-900">No hay peluqueros activos. Revisa Administración → Equipo.</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div>
    <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button disabled={saving || !staffId || staffId === visit.staffId || !staff.some((item) => item.id === staffId)} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar responsable"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
