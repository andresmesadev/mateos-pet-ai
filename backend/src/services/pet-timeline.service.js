const prisma = require("../lib/prisma");
const { listNextActions } = require("./next-action.service");
// Clasificadores de dominio (compartidos con los mappers del dashboard)
const { appointmentKind, standaloneRecordKind } = require("../routes/dashboard/shared");

/**
 * Construye el timeline unificado de una mascota: { items, nextActions }.
 *
 * FUENTE ÚNICA DE VERDAD para GET /pets/:id/timeline (pantalla) y
 * GET /pets/:id/report (PDF). Antes la lógica estaba duplicada en ambos
 * endpoints y ya había divergido: el PDF no incluía las próximas acciones de
 * "Cita programada" ni "Vacuna próxima". Centralizarla evita esa divergencia.
 */
async function buildPetTimeline(petId, tenantId) {
  const now = new Date();

  const [appointments, standaloneRecords, storedActions] = await Promise.all([
    prisma.appointment.findMany({
      where: tenantId ? { petId, tenantId } : { petId },
      orderBy: { date: "desc" },
      include: {
        service: { select: { name: true, category: { select: { name: true } } } },
        staff: { select: { name: true } },
        medicalRecord: { include: { staff: { select: { name: true } } } },
      },
    }),
    prisma.medicalRecord.findMany({
      where: { petId, appointmentId: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { staff: { select: { name: true } } },
    }),
    listNextActions(petId, tenantId),
  ]);

  const items = [];
  const nextActions = [];

  for (const appt of appointments) {
    const rec = appt.medicalRecord;
    const kind = appointmentKind(appt);

    items.push({
      id: `appt-${appt.id}`,
      kind,
      date: appt.date.toISOString(),
      title: appt.service?.name ?? appt.serviceType,
      appointmentId: appt.id,
      appointmentStatus: appt.status,
      serviceType: appt.serviceType,
      serviceName: appt.service?.name ?? null,
      staffName: rec?.staff?.name ?? appt.staff?.name ?? null,
      recordId: rec?.id ?? null,
      reason: rec?.reason ?? null,
      findings: rec?.findings ?? null,
      diagnosis: rec?.diagnosis ?? null,
      treatment: rec?.treatment ?? null,
      recommendations: rec?.recommendations ?? null,
      weight: rec?.weight ?? null,
      nextControlAt: rec?.nextControlAt?.toISOString() ?? null,
      detail: null,
    });

    if (rec?.nextControlAt && new Date(rec.nextControlAt) > now) {
      nextActions.push({
        id: `next-${rec.id}`,
        kind: "next_action",
        date: rec.nextControlAt.toISOString(),
        title: "Control recomendado",
        detail: rec.diagnosis ? `Seguimiento: ${rec.diagnosis}` : null,
      });
    }

    if (
      appt.date > now &&
      !["completed", "cancelled", "no_show"].includes(appt.status)
    ) {
      nextActions.push({
        id: `appointment-${appt.id}`,
        kind: "next_action",
        date: appt.date.toISOString(),
        title: `Cita programada: ${appt.service?.name ?? appt.serviceType}`,
        detail: appt.staff?.name ? `Con ${appt.staff.name}` : null,
      });
    }
  }

  for (const rec of standaloneRecords) {
    items.push({
      id: `rec-${rec.id}`,
      kind: standaloneRecordKind(rec),
      date: (rec.date ?? rec.createdAt).toISOString(),
      title: rec.title,
      appointmentId: null,
      appointmentStatus: null,
      serviceType: null,
      serviceName: null,
      staffName: rec.staff?.name ?? null,
      recordId: rec.id,
      reason: rec.reason ?? null,
      findings: rec.findings ?? null,
      diagnosis: rec.diagnosis ?? null,
      treatment: rec.treatment ?? null,
      recommendations: rec.recommendations ?? null,
      weight: rec.weight ?? null,
      nextControlAt: rec.nextControlAt?.toISOString() ?? null,
      detail: rec.detail ?? null,
    });

    if (rec.nextControlAt && new Date(rec.nextControlAt) > now) {
      nextActions.push({
        id: `next-rec-${rec.id}`,
        kind: "next_action",
        date: rec.nextControlAt.toISOString(),
        title: "Control recomendado",
        detail: rec.title,
      });
    }

    if (rec.type === "vaccine" && rec.date && rec.date > now) {
      nextActions.push({
        id: `vaccine-${rec.id}`,
        kind: "next_action",
        date: rec.date.toISOString(),
        title: `Vacuna próxima: ${rec.title}`,
        detail: rec.detail ?? null,
      });
    }
  }

  // Merge de la tabla PetNextAction, evitando duplicar acciones ya derivadas
  // del nextControlAt de un registro.
  for (const sa of storedActions) {
    const alreadyCovered = nextActions.some(
      (a) => a.id === `next-${sa.sourceRecordId}`
    );
    if (alreadyCovered) continue;

    nextActions.push({
      id: `action-${sa.id}`,
      kind: "next_action",
      date: sa.dueAt.toISOString(),
      title:
        sa.type === "grooming" ? "Grooming pendiente"
        : sa.type === "vaccine" ? "Vacuna pendiente"
        : sa.type === "exam" ? "Examen pendiente"
        : sa.type === "treatment" ? "Tratamiento pendiente"
        : "Control recomendado",
      detail: sa.notes,
      actionId: sa.id,
      actionType: sa.type,
    });
  }

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  nextActions.sort((a, b) => new Date(a.date) - new Date(b.date));

  return { items, nextActions };
}

module.exports = { buildPetTimeline };
