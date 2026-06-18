const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { appointmentKind, standaloneRecordKind } = require("./shared");
const { updatePet } = require("../../services/pet.service");
const {
  createRecord,
  getRecordsByPet,
} = require("../../services/medical-record.service");
const {
  VALID_TYPES: VALID_ACTION_TYPES,
  listNextActions,
  createNextAction,
  updateNextAction,
  pendingActionsSummary,
} = require("../../services/next-action.service");

const VET_SERVICE_TYPES = ["vet", "consultation", "veterinary_consultation"];

const GROOMING_KEYWORDS = [
  "grooming",
  "bath",
  "baño",
  "peluquer",
  "corte",
  "spa",
  "deslanado",
  "colorimetría",
  "colorimetria",
  "antipulgas",
];

router.get("/pets", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const pets = await prisma.pet.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: { phone: true },
        },
        _count: {
          select: {
            medicalRecords: true,
            appointments: true,
          },
        },
      },
    });

    res.json(
      pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        breed: pet.breed ?? null,
        gender: pet.gender ?? null,
        birthDate: pet.birthDate ?? null,
        weight: pet.weight ?? null,
        sterilized: pet.sterilized ?? null,
        notes: pet.notes ?? null,
        owner: {
          phone: pet.owner.phone,
        },
        _count: pet._count,
      }))
    );
  } catch (error) {
    console.error("[Dashboard] Pets error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/pets/:id/records", async (req, res) => {
  try {
    const { id } = req.params;

    const pet = await prisma.pet.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!pet) {
      return res.status(404).json({
        error: "Pet not found",
      });
    }

    const records = await prisma.medicalRecord.findMany({
      where: { petId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { staff: { select: { name: true } } },
    });

    res.json(
      records.map((record) => ({
        id: record.id,
        appointmentId: record.appointmentId,
        type: record.type,
        title: record.title,
        detail: record.detail,
        date: record.date,
        // Clinical fields (TAREA 10)
        staffId: record.staffId,
        staffName: record.staff?.name ?? null,
        reason: record.reason,
        findings: record.findings,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        recommendations: record.recommendations,
        weight: record.weight,
        nextControlAt: record.nextControlAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }))
    );
  } catch (error) {
    console.error("[Dashboard] Pet records error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.post("/pets/:id/records", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, detail, date } = req.body ?? {};

    const pet = await prisma.pet.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!pet) {
      return res.status(404).json({
        error: "Pet not found",
      });
    }

    const record = await createRecord(
      id,
      type || "note",
      title,
      detail,
      date
    );

    res.status(201).json({
      id: record.id,
      type: record.type,
      title: record.title,
      detail: record.detail,
      date: record.date,
      createdAt: record.createdAt,
    });
  } catch (error) {
    console.error("[Dashboard] Create pet record error:", error.message);

    if (
      error.message.includes("required") ||
      error.message.includes("must be one of") ||
      error.message.includes("Invalid date")
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// ────────────────────────────────────────────────────────────
// Unified pet timeline (TAREA 11)
// ────────────────────────────────────────────────────────────

router.get("/pets/:id/timeline", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const pet = await prisma.pet.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    const [appointments, standaloneRecords] = await Promise.all([
      prisma.appointment.findMany({
        where: tenantId ? { petId: id, tenantId } : { petId: id },
        orderBy: { date: "desc" },
        include: {
          service: { select: { name: true, category: true } },
          staff: { select: { name: true } },
          medicalRecord: { include: { staff: { select: { name: true } } } },
        },
      }),
      prisma.medicalRecord.findMany({
        where: { petId: id, appointmentId: null },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { staff: { select: { name: true } } },
      }),
    ]);

    const now = new Date();
    const items = [];
    const nextActions = [];

    for (const appt of appointments) {
      const rec = appt.medicalRecord;
      const kind = appointmentKind(appt);

      const item = {
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
      };

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

      items.push(item);
    }

    for (const rec of standaloneRecords) {
      const item = {
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
      };

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

      items.push(item);
    }

    // Merge PetNextAction table into nextActions
    const storedActions = await listNextActions(id, tenantId);
    for (const sa of storedActions) {
      // Avoid duplicating actions already derived from nextControlAt on records
      const alreadyCovered = nextActions.some((a) => a.id === `next-${sa.sourceRecordId}`);
      if (!alreadyCovered) {
        nextActions.push({
          id: `action-${sa.id}`,
          kind: "next_action",
          date: sa.dueAt.toISOString(),
          title: sa.type === "grooming" ? "Grooming pendiente"
            : sa.type === "vaccine" ? "Vacuna pendiente"
            : sa.type === "exam" ? "Examen pendiente"
            : sa.type === "treatment" ? "Tratamiento pendiente"
            : "Control recomendado",
          detail: sa.notes,
          actionId: sa.id,
          actionType: sa.type,
        });
      }
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    nextActions.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ items, nextActions });
  } catch (error) {
    console.error("[Dashboard] Pet timeline error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pets/:id/report — ficha clínica completa para exportar como PDF
// Retorna: datos de la mascota + dueño + timeline completa + próximas acciones
router.get("/pets/:id/report", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const pet = await prisma.pet.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        owner: { select: { id: true, name: true, phone: true, email: true, address: true } },
        tenant: { select: { name: true, phone: true, email: true, address: true, logoUrl: true } },
      },
    });
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    // Reutilizamos la misma lógica que /timeline
    const timelineRes = await new Promise((resolve, reject) => {
      const fakeReq = { params: { id }, tenant: req.tenant };
      const fakeRes = {
        json: (data) => resolve(data),
        status: (code) => ({ json: (err) => reject(new Error(err.error ?? "timeline error")) }),
      };
      // Invocar el handler directamente no es limpio — hacemos la query directamente
      resolve(null);
    });

    // Traer timeline directamente
    const now = new Date();
    const [appointments, standaloneRecords, storedActions] = await Promise.all([
      prisma.appointment.findMany({
        where: tenantId ? { petId: id, tenantId } : { petId: id },
        orderBy: { date: "desc" },
        include: {
          service: { select: { name: true, category: true } },
          staff: { select: { name: true } },
          medicalRecord: { include: { staff: { select: { name: true } } } },
        },
      }),
      prisma.medicalRecord.findMany({
        where: { petId: id, appointmentId: null },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { staff: { select: { name: true } } },
      }),
      listNextActions(id, tenantId),
    ]);

    const items = [];
    const nextActions = [];

    for (const appt of appointments) {
      const rec = appt.medicalRecord;
      const kind = appointmentKind(appt);
      items.push({
        id: `appt-${appt.id}`, kind,
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
        nextActions.push({ id: `next-${rec.id}`, kind: "next_action", date: rec.nextControlAt.toISOString(), title: "Control recomendado", detail: rec.diagnosis ? `Seguimiento: ${rec.diagnosis}` : null });
      }
    }

    for (const rec of standaloneRecords) {
      items.push({
        id: `rec-${rec.id}`, kind: standaloneRecordKind(rec),
        date: (rec.date ?? rec.createdAt).toISOString(),
        title: rec.title,
        appointmentId: null, appointmentStatus: null,
        serviceType: null, serviceName: null,
        staffName: rec.staff?.name ?? null, recordId: rec.id,
        reason: rec.reason ?? null, findings: rec.findings ?? null,
        diagnosis: rec.diagnosis ?? null, treatment: rec.treatment ?? null,
        recommendations: rec.recommendations ?? null,
        weight: rec.weight ?? null,
        nextControlAt: rec.nextControlAt?.toISOString() ?? null,
        detail: rec.detail ?? null,
      });
      if (rec.nextControlAt && new Date(rec.nextControlAt) > now) {
        nextActions.push({ id: `next-rec-${rec.id}`, kind: "next_action", date: rec.nextControlAt.toISOString(), title: "Control recomendado", detail: rec.title });
      }
    }

    for (const sa of storedActions) {
      if (!nextActions.some((a) => a.id === `next-${sa.sourceRecordId}`)) {
        nextActions.push({
          id: `action-${sa.id}`, kind: "next_action",
          date: sa.dueAt.toISOString(),
          title: sa.type === "grooming" ? "Grooming pendiente" : sa.type === "vaccine" ? "Vacuna pendiente" : sa.type === "exam" ? "Examen pendiente" : sa.type === "treatment" ? "Tratamiento pendiente" : "Control recomendado",
          detail: sa.notes, actionId: sa.id, actionType: sa.type,
        });
      }
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    nextActions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Historial de peso (solo entradas con peso registrado)
    const weightHistory = items
      .filter((i) => i.weight != null)
      .map((i) => ({ date: i.date, weight: i.weight, title: i.title }))
      .reverse(); // cronológico asc

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        type: pet.type,
        breed: pet.breed,
        gender: pet.gender,
        birthDate: pet.birthDate,
        weight: pet.weight,
        sterilized: pet.sterilized,
        notes: pet.notes,
        createdAt: pet.createdAt,
      },
      owner: pet.owner,
      tenant: pet.tenant,
      timeline: { items, nextActions },
      weightHistory,
    });
  } catch (error) {
    console.error("[Dashboard] Pet report error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/pets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { breed, gender, birthDate, weight, sterilized, notes } = req.body ?? {};
    const updated = await updatePet(id, { breed, gender, birthDate, weight, sterilized, notes });
    res.json({
      id: updated.id,
      breed: updated.breed,
      gender: updated.gender,
      birthDate: updated.birthDate,
      weight: updated.weight,
      sterilized: updated.sterilized,
      notes: updated.notes,
    });
  } catch (error) {
    console.error("[Dashboard] Update pet error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Pet not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// ────────────────────────────────────────────────────────────
// Next actions — TAREA 12
// ────────────────────────────────────────────────────────────

router.get("/next-actions/summary", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const summary = await pendingActionsSummary(tenantId);
    res.json(summary);
  } catch (error) {
    console.error("[Dashboard] Next actions summary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/pets/:id/next-actions", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const includeAll = req.query.all === "true";

    const pet = await prisma.pet.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    const actions = await listNextActions(id, tenantId, { includeAll });
    res.json(actions);
  } catch (error) {
    console.error("[Dashboard] List next actions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/pets/:id/next-actions", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const { type, notes, dueAt } = req.body ?? {};

    const pet = await prisma.pet.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    if (!dueAt) return res.status(400).json({ error: "dueAt es requerido" });
    if (!VALID_ACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: `Tipo inválido. Valores: ${VALID_ACTION_TYPES.join(", ")}` });
    }

    const action = await createNextAction({ petId: id, tenantId, type, notes, dueAt });
    res.status(201).json(action);
  } catch (error) {
    console.error("[Dashboard] Create next action error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/next-actions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const { status, notes, dueAt } = req.body ?? {};

    const updated = await updateNextAction(id, tenantId, { status, notes, dueAt });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update next action error:", error.message);
    if (error.message.includes("inválido")) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
