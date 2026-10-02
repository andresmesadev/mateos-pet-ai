"use client";

import { useEffect, useState } from "react";
import { proxyUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatColombiaDateTime } from "@/lib/appointments";
import { type GroomingVisit } from "@/lib/grooming";

type PetSummary = { breed: string | null; operationalAlerts: string | null; owner: { name: string | null; phone: string } };

export function GroomingPetSummary({ visit, tenantId }: { visit: GroomingVisit; tenantId?: string }) {
  const [data, setData] = useState<{ pet: PetSummary | null; previous: GroomingVisit | null } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!visit.petId) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tenantId) params.set("tenantId", tenantId);
    const historyParams = new URLSearchParams(params);
    historyParams.set("exclude", visit.id);
    historyParams.set("cursor", visit.id);
    async function load() {
      try {
        const [petResponse, historyResponse] = await Promise.all([
          fetch(proxyUrl(`/api/dashboard/pets/${encodeURIComponent(visit.petId!)}?${params}`), { signal: controller.signal, cache: "no-store" }),
          fetch(proxyUrl(`/api/dashboard/grooming/pets/${encodeURIComponent(visit.petId!)}/notes?${historyParams}`), { signal: controller.signal, cache: "no-store" }),
        ]);
        if (!petResponse.ok || !historyResponse.ok) throw new Error();
        const pet = await petResponse.json() as PetSummary;
        const history = await historyResponse.json() as { visits: GroomingVisit[] };
        if (!Array.isArray(history.visits)) throw new Error();
        // Exclude later appointments: this is the context that preceded this visit.
        const previous = history.visits.find((item) => new Date(item.date).getTime() < new Date(visit.date).getTime()) ?? null;
        if (!controller.signal.aborted) { setData({ pet, previous }); setError(false); }
      } catch { if (!controller.signal.aborted) setError(true); }
    }
    void load();
    return () => controller.abort();
  }, [visit.petId, visit.id, visit.date, tenantId, retry]);

  if (!visit.petId) return <p className="text-sm text-muted-foreground">Esta cita aún no tiene una mascota vinculada.</p>;
  return <section className="space-y-3 rounded-xl border bg-slate-50 p-4" aria-label="Ficha rápida de la mascota">
    <h3 className="font-semibold">Antes del baño o corte</h3>
    {error ? <div role="alert" className="text-sm text-amber-900">No se pudo cargar la ficha y la última nota. <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>Reintentar ficha</Button></div> : !data ? <p role="status" className="text-sm text-muted-foreground">Cargando ficha de la mascota…</p> : <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Raza</dt><dd className="font-medium">{data.pet?.breed || "Sin registrar"}</dd></div><div><dt className="text-muted-foreground">Propietario</dt><dd className="font-medium">{data.pet?.owner.name || visit.clientName || "Sin registrar"}</dd><dd className="text-muted-foreground">{data.pet?.owner.phone}</dd></div></dl>
      <div><p className="text-sm font-medium">Cuidados y observaciones de la ficha</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{data.pet?.operationalAlerts || "No hay observaciones registradas."}</p></div>
      <div className="border-t pt-3"><p className="text-sm font-medium">Última nota anterior de peluquería</p>{data.previous ? <><p className="mt-1 text-xs text-muted-foreground">{formatColombiaDateTime(data.previous.date)} · {data.previous.serviceName ?? "Peluquería"}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{data.previous.groomingNotes}</p></> : <p className="mt-1 text-sm text-muted-foreground">No hay notas de visitas anteriores.</p>}</div>
    </>}
  </section>;
}
