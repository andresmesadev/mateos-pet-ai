"use client";

import { useEffect, useState } from "react";
import { AlertCircle, HeartPulse } from "lucide-react";

import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { VetClinicalHistory } from "@/components/dashboard/vet-clinical-history";
import { type DashboardPet, type PetMedicalRecord, formatRecordDate, formatPetType } from "@/lib/pets";

type PatientContext = { pet: DashboardPet; records: PetMedicalRecord[] };

export function VetPatientContext({ petId, appointmentId, preview = false }: { petId: string; appointmentId: string; preview?: boolean }) {
  const tenant = useTenant();
  const [data, setData] = useState<PatientContext | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const [petResponse, recordsResponse] = await Promise.all([
          fetch(proxyUrl(`/api/dashboard/pets/${petId}${tenantQuery(tenant)}`), { cache: "no-store" }),
          fetch(proxyUrl(`/api/dashboard/pets/${petId}/records${tenantQuery(tenant)}`), { cache: "no-store" }),
        ]);
        if (!petResponse.ok || !recordsResponse.ok) throw new Error("No se pudieron cargar los antecedentes");
        const [pet, records] = await Promise.all([
          petResponse.json() as Promise<DashboardPet>,
          recordsResponse.json() as Promise<PetMedicalRecord[]>,
        ]);
        if (!cancelled) setData({ pet, records: Array.isArray(records) ? records : [] });
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [petId, preview, retry, tenant]);

  const prior = (data?.records ?? []).filter((record) => record.appointmentId !== appointmentId);
  const allergies = prior.filter((record) => record.type === "allergy");
  const consultations = prior.filter((record) => record.type === "consultation");
  const lastWeight = prior.find((record) => record.weight != null);

  return (
    <section aria-labelledby="paciente-contexto" className="overflow-hidden rounded-2xl border border-teal-200 bg-teal-50/30">
      <div className="flex items-center gap-2 border-b border-teal-100 px-4 py-3 sm:px-5">
        <HeartPulse aria-hidden="true" className="size-4 text-teal-700" />
        <h3 id="paciente-contexto" className="text-sm font-bold text-teal-950">Antes de atender</h3>
        <span className="ml-auto text-xs text-teal-800">Datos registrados del paciente</span>
      </div>
      {preview ? <p className="px-5 py-4 text-sm text-slate-600">Los antecedentes reales aparecerán aquí al abrir una consulta.</p>
        : loading ? <p role="status" className="px-5 py-4 text-sm text-slate-600">Cargando antecedentes…</p>
        : error ? <div role="alert" className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-amber-900"><span>No se pudieron consultar los antecedentes. Puedes registrar la atención, pero revisa la historia antes de continuar.</span><button type="button" className="shrink-0 font-semibold underline" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>
        : data && <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-slate-500">Paciente</p><p className="font-semibold text-slate-900">{formatPetType(data.pet.type)}{data.pet.breed ? ` · ${data.pet.breed}` : ""}</p></div>
            <div><p className="text-xs text-slate-500">Último peso registrado</p><p className="font-semibold text-slate-900">{lastWeight?.weight != null ? `${lastWeight.weight} kg · ${formatRecordDate(lastWeight.date ?? lastWeight.createdAt)}` : data.pet.weight != null ? `${data.pet.weight} kg` : "Sin registro"}</p></div>
            <div><p className="text-xs text-slate-500">Consultas anteriores</p><p className="font-semibold text-slate-900">{consultations.length}</p></div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <div className="flex items-start gap-2"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Alergias registradas</p><p className="mt-0.5">{allergies.length ? allergies.map((record) => record.title).join(", ") : "No hay alergias registradas en la historia."}</p></div></div>
          </div>
          <VetClinicalHistory key={`${petId}:${appointmentId}`} records={prior} petId={petId} />
        </div>}
    </section>
  );
}
