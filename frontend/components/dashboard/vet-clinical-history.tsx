"use client";

import { useState } from "react";
import { type PetMedicalRecord, formatRecordDate } from "@/lib/pets";
import { VetRecordRevisions } from "@/components/dashboard/vet-record-revisions";

export function VetClinicalHistory({ records, petId }: { records: PetMedicalRecord[]; petId: string }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(10);
  const sorted = [...records].sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt));
  const getYear = (record: PetMedicalRecord) => new Date(record.date ?? record.createdAt).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 4);
  const years = [...new Set(sorted.map(getYear))].sort().reverse();
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO");
  const term = normalize(query.trim());
  const filtered = sorted.filter((record) => (year === "all" || getYear(record) === year) && (kind === "all" || record.type === kind) && (!term || normalize([record.title, record.reason, record.findings, record.diagnosis, record.treatment, record.recommendations, record.detail, record.staffName].filter(Boolean).join(" ")).includes(term)));
  return <details className="rounded-xl border border-teal-100 bg-white">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-teal-900">Historia completa del paciente ({records.length} registros anteriores)</summary>
    <div className="space-y-4 border-t border-teal-100 p-4">
      <p className="text-xs text-slate-600">Consulta los registros anteriores sin modificar la atención actual. Cada nueva visita conserva su propio registro.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold text-slate-700">Buscar en la historia<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(10); }} placeholder="Motivo, diagnóstico o profesional" className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>
        <label className="space-y-1 text-xs font-semibold text-slate-700">Año<select value={year} onChange={(event) => { setYear(event.target.value); setLimit(10); }} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option value="all">Todos los años</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="space-y-1 text-xs font-semibold text-slate-700">Tipo de registro<select value={kind} onChange={(event) => { setKind(event.target.value); setLimit(10); }} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option value="all">Todos los registros</option><option value="consultation">Consultas</option><option value="allergy">Alergias</option><option value="vaccine">Vacunas</option><option value="note">Notas</option><option value="deworming">Desparasitación</option><option value="grooming">Peluquería</option></select></label>
      </div>
      <p role="status" className="text-xs text-slate-600">{filtered.length} registros encontrados · Del más reciente al más antiguo</p>
      {filtered.length === 0 && <p className="text-sm text-slate-600">No hay registros con estos filtros.</p>}
      {filtered.slice(0, limit).map((record) => <details key={record.id} className="rounded-xl border border-slate-200">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-slate-900">{formatRecordDate(record.date ?? record.createdAt)} · {record.title}<span className="mt-1 block text-xs font-normal text-slate-600">{record.staffName ?? "Profesional no registrado"}{record.diagnosis ? ` · ${record.diagnosis}` : ""}</span></summary>
        <div className="space-y-4 border-t border-slate-200 p-3">
          <dl className="space-y-3">{[["Motivo de consulta", record.reason], ["Hallazgos y examen físico", record.findings], ["Diagnóstico", record.diagnosis], ["Tratamiento", record.treatment], ["Recomendaciones", record.recommendations], ["Detalle", record.detail], ["Peso", record.weight != null ? `${record.weight} kg` : null], ["Control recomendado", record.nextControlAt ? formatRecordDate(record.nextControlAt) : null]].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value || "Sin registrar"}</dd></div>)}</dl>
          <p className="text-xs text-slate-500">Autor: {record.createdByStaffName ?? "No registrado individualmente"} · Último editor: {record.updatedByStaffName ?? "No registrado individualmente"}</p>
          {record.appointmentId && <VetRecordRevisions petId={petId} recordId={record.id} version={record.version} />}
        </div>
      </details>)}
      {filtered.length > limit && <button type="button" onClick={() => setLimit((value) => value + 10)} className="min-h-10 rounded-lg border border-teal-200 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50">Mostrar 10 registros más</button>}
    </div>
  </details>;
}
