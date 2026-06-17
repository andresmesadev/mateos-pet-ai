"use client";

import { useEffect } from "react";
import { type TimelineItem, type NextAction } from "@/app/print/pets/[id]/page";

type PetReport = {
  pet: {
    name: string;
    type: string;
    breed: string | null;
    gender: string | null;
    birthDate: string | null;
    weight: number | null;
    sterilized: boolean | null;
    notes: string | null;
    createdAt: string;
  };
  owner: {
    name: string | null;
    phone: string;
    email: string | null;
    address: string | null;
  };
  tenant: {
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
  } | null;
  timeline: {
    items: TimelineItem[];
    nextActions: NextAction[];
  };
  weightHistory: { date: string; weight: number; title: string }[];
};

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function petTypeLabel(type: string): string {
  return type === "dog" ? "Perro" : type === "cat" ? "Gato" : type ?? "Otro";
}

function petEmoji(type: string): string {
  return type === "dog" ? "🐶" : type === "cat" ? "🐱" : "🐰";
}

function kindLabel(kind: string): string {
  const MAP: Record<string, string> = {
    consultation: "Consulta veterinaria",
    grooming: "Grooming / peluquería",
    vaccine: "Vacuna",
    deworming: "Desparasitación",
    exam: "Examen",
    image: "Imagen diagnóstica",
    treatment: "Tratamiento",
    allergy: "Alergia",
    note: "Nota clínica",
    cancelled: "Cita cancelada",
    no_show: "No se presentó",
    other_appt: "Otra cita",
  };
  return MAP[kind] ?? kind;
}

function kindIcon(kind: string): string {
  const MAP: Record<string, string> = {
    consultation: "🩺",
    grooming: "✂️",
    vaccine: "💉",
    deworming: "🪱",
    exam: "🔬",
    image: "📷",
    treatment: "🩹",
    allergy: "🤧",
    note: "📝",
    cancelled: "✗",
    no_show: "⚠",
    other_appt: "📅",
  };
  return MAP[kind] ?? "•";
}

function actionTypeIcon(t?: string): string {
  const MAP: Record<string, string> = {
    control: "🩺",
    vaccine: "💉",
    grooming: "✂️",
    exam: "🔬",
    treatment: "🩹",
    other: "📋",
  };
  return t ? (MAP[t] ?? "📋") : "📋";
}

// ── Field ─────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={{ fontWeight: 600, color: "#555", fontSize: 11 }}>{label}: </span>
      <span style={{ fontSize: 12 }}>{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function PdfPrintView({ report }: { report: PetReport }) {
  const { pet, owner, tenant, timeline, weightHistory } = report;

  // Auto-open print dialog on load
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, []);

  const vaccines = timeline.items.filter((i) => i.kind === "vaccine");
  const consultations = timeline.items.filter((i) => i.kind === "consultation");
  const otherItems = timeline.items.filter((i) => !["vaccine", "consultation", "cancelled", "no_show"].includes(i.kind));

  const generatedAt = fmtDateTime(new Date().toISOString());

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 15mm 18mm; size: A4; }
        }
        body { font-family: -apple-system, Arial, sans-serif; color: #222; background: #fff; }
        .page { max-width: 800px; margin: 0 auto; padding: 24px; }
        .section-title {
          font-size: 13px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: #444; border-bottom: 1.5px solid #ddd;
          padding-bottom: 4px; margin: 20px 0 10px;
        }
        .record-card {
          border: 1px solid #e5e5e5; border-radius: 6px;
          padding: 10px 12px; margin-bottom: 8px; break-inside: avoid;
        }
        .record-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
        .record-icon { font-size: 14px; }
        .record-title { font-weight: 600; font-size: 13px; }
        .record-date { font-size: 11px; color: #777; margin-left: auto; }
        .record-staff { font-size: 11px; color: #888; margin-bottom: 6px; }
        .tag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
        .action-row {
          display: flex; align-items: baseline; gap: 6px;
          padding: 7px 10px; margin-bottom: 6px;
          border: 1px solid #fbbf24; border-radius: 5px; background: #fffbeb;
          break-inside: avoid;
        }
        .weight-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .weight-table th { background: #f5f5f5; padding: 4px 8px; text-align: left; font-size: 11px; font-weight: 600; border-bottom: 1px solid #e5e5e5; }
        .weight-table td { padding: 4px 8px; border-bottom: 1px solid #f0f0f0; }
      `}</style>

      {/* No-print toolbar */}
      <div className="no-print" style={{ background: "#f5f5f5", borderBottom: "1px solid #ddd", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Ficha clínica — {pet.name}</span>
        <button
          onClick={() => window.print()}
          style={{ marginLeft: "auto", background: "#111", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          Imprimir / Guardar PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: "transparent", border: "1px solid #ccc", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
        >
          Cerrar
        </button>
      </div>

      <div className="page">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {petEmoji(pet.type)} {pet.name}
            </div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
              {petTypeLabel(pet.type)}{pet.breed ? ` · ${pet.breed}` : ""}
              {pet.gender ? ` · ${pet.gender === "M" ? "Macho" : pet.gender === "F" ? "Hembra" : pet.gender}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {tenant && <div style={{ fontWeight: 700, fontSize: 14 }}>{tenant.name}</div>}
            {tenant?.phone && <div style={{ fontSize: 12, color: "#555" }}>{tenant.phone}</div>}
            {tenant?.address && <div style={{ fontSize: 11, color: "#777" }}>{tenant.address}</div>}
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>Generado: {generatedAt}</div>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #222", marginBottom: 16 }} />

        {/* Datos básicos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          <div>
            <div className="section-title">Datos de la mascota</div>
            <Field label="Nombre" value={pet.name} />
            <Field label="Especie" value={petTypeLabel(pet.type)} />
            <Field label="Raza" value={pet.breed} />
            <Field label="Género" value={pet.gender === "M" ? "Macho" : pet.gender === "F" ? "Hembra" : pet.gender} />
            <Field label="Fecha de nacimiento" value={fmtDate(pet.birthDate)} />
            <Field label="Peso actual" value={pet.weight ? `${pet.weight} kg` : null} />
            <Field label="Esterilizado/a" value={pet.sterilized === true ? "Sí" : pet.sterilized === false ? "No" : null} />
            {pet.notes && <Field label="Notas" value={pet.notes} />}
            <Field label="Registrado el" value={fmtDate(pet.createdAt)} />
          </div>
          <div>
            <div className="section-title">Propietario/a</div>
            <Field label="Nombre" value={owner.name} />
            <Field label="Teléfono" value={owner.phone} />
            <Field label="Email" value={owner.email} />
            <Field label="Dirección" value={owner.address} />
          </div>
        </div>

        {/* Próximas acciones */}
        {timeline.nextActions.length > 0 && (
          <>
            <div className="section-title">Próximas acciones</div>
            {timeline.nextActions.map((a) => (
              <div key={a.id} className="action-row">
                <span>{actionTypeIcon(a.actionType)}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</span>
                <span style={{ fontSize: 12, color: "#666" }}>{fmtDate(a.date)}</span>
                {a.detail && <span style={{ fontSize: 12, color: "#888" }}>· {a.detail}</span>}
              </div>
            ))}
          </>
        )}

        {/* Historial de peso */}
        {weightHistory.length > 0 && (
          <>
            <div className="section-title">Evolución de peso</div>
            <table className="weight-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Peso (kg)</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {weightHistory.map((w, i) => (
                  <tr key={i}>
                    <td>{fmtDate(w.date)}</td>
                    <td style={{ fontWeight: 600 }}>{w.weight} kg</td>
                    <td style={{ color: "#666" }}>{w.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Vacunas */}
        {vaccines.length > 0 && (
          <>
            <div className="section-title">Vacunas ({vaccines.length})</div>
            {vaccines.map((item) => (
              <div key={item.id} className="record-card">
                <div className="record-header">
                  <span className="record-icon">💉</span>
                  <span className="record-title">{item.title}</span>
                  <span className="record-date">{fmtDate(item.date)}</span>
                </div>
                {item.staffName && <div className="record-staff">Aplicada por: {item.staffName}</div>}
                <Field label="Detalle" value={item.detail} />
                {item.nextControlAt && <Field label="Próxima dosis" value={fmtDate(item.nextControlAt)} />}
              </div>
            ))}
          </>
        )}

        {/* Consultas */}
        {consultations.length > 0 && (
          <>
            <div className="section-title">Consultas veterinarias ({consultations.length})</div>
            {consultations.map((item) => (
              <div key={item.id} className="record-card">
                <div className="record-header">
                  <span className="record-icon">🩺</span>
                  <span className="record-title">{item.title}</span>
                  <span className="record-date">{fmtDate(item.date)}</span>
                </div>
                {item.staffName && <div className="record-staff">Atendido por: {item.staffName}</div>}
                {item.weight && <Field label="Peso en consulta" value={`${item.weight} kg`} />}
                <div className="tag-grid">
                  <Field label="Motivo" value={item.reason} />
                  <Field label="Hallazgos" value={item.findings} />
                  <Field label="Diagnóstico" value={item.diagnosis} />
                  <Field label="Tratamiento" value={item.treatment} />
                </div>
                {item.recommendations && <Field label="Recomendaciones" value={item.recommendations} />}
                {item.nextControlAt && <Field label="Control siguiente" value={fmtDate(item.nextControlAt)} />}
              </div>
            ))}
          </>
        )}

        {/* Otros registros */}
        {otherItems.length > 0 && (
          <>
            <div className="section-title">Otros registros ({otherItems.length})</div>
            {otherItems.map((item) => (
              <div key={item.id} className="record-card">
                <div className="record-header">
                  <span className="record-icon">{kindIcon(item.kind)}</span>
                  <span className="record-title">{kindLabel(item.kind)}{item.title !== kindLabel(item.kind) ? ` — ${item.title}` : ""}</span>
                  <span className="record-date">{fmtDate(item.date)}</span>
                </div>
                {item.staffName && <div className="record-staff">{item.staffName}</div>}
                {item.weight && <Field label="Peso" value={`${item.weight} kg`} />}
                <Field label="Detalle" value={item.detail} />
                <div className="tag-grid">
                  <Field label="Diagnóstico" value={item.diagnosis} />
                  <Field label="Tratamiento" value={item.treatment} />
                </div>
                <Field label="Recomendaciones" value={item.recommendations} />
              </div>
            ))}
          </>
        )}

        {timeline.items.length === 0 && (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#999", fontSize: 14 }}>
            Sin registros clínicos aún.
          </div>
        )}

        {/* Pie de página */}
        <div style={{ marginTop: 32, paddingTop: 12, borderTop: "1px solid #e5e5e5", fontSize: 10, color: "#aaa", display: "flex", justifyContent: "space-between" }}>
          <span>Ficha clínica generada por Mateos Pet AI</span>
          <span>{generatedAt}</span>
        </div>
      </div>
    </>
  );
}
