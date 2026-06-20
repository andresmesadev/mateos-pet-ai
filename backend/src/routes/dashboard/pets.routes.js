const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { updatePet } = require("../../services/pet.service");
const { buildPetTimeline } = require("../../services/pet-timeline.service");
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

    const mapped = pets.map((pet) => ({
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
      }));
    res.json({ data: mapped, total: mapped.length });
  } catch (error) {
    console.error("[Dashboard] Pets error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

const VALID_PET_TYPES = ["dog", "cat", "other"];

// Crear mascota manualmente. El dueño se resuelve por teléfono dentro del
// tenant; si no existe, se crea (find-or-create), respetando el modelo en que
// los clientes están identificados por su número.
router.post("/pets", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, type, ownerPhone, ownerName, breed, notes } = req.body ?? {};

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanType = typeof type === "string" ? type.trim().toLowerCase() : "";
    const cleanPhone = typeof ownerPhone === "string" ? ownerPhone.replace(/\s+/g, "").trim() : "";

    if (!cleanName) return res.status(400).json({ error: "El nombre de la mascota es requerido" });
    if (!VALID_PET_TYPES.includes(cleanType)) {
      return res.status(400).json({ error: `Tipo inválido. Valores: ${VALID_PET_TYPES.join(", ")}` });
    }
    if (!cleanPhone) return res.status(400).json({ error: "El teléfono del dueño es requerido" });

    // find-or-create del dueño (scoped al tenant)
    let owner = await prisma.user.findFirst({
      where: { phone: cleanPhone, ...(tenantId ? { tenantId } : {}) },
      select: { id: true },
    });

    if (!owner) {
      try {
        owner = await prisma.user.create({
          data: { phone: cleanPhone, tenantId: tenantId ?? null, name: ownerName?.trim() || null },
          select: { id: true },
        });
      } catch (error) {
        if (error.code === "P2002") {
          return res.status(409).json({ error: "Ese teléfono pertenece a otro cliente" });
        }
        throw error;
      }
    }

    const pet = await prisma.pet.create({
      data: {
        name: cleanName,
        type: cleanType,
        tenantId: tenantId ?? null,
        ownerId: owner.id,
        breed: breed?.trim() || null,
        notes: notes?.trim() || null,
      },
      select: { id: true, name: true, type: true },
    });

    res.status(201).json(pet);
  } catch (error) {
    console.error("[Dashboard] Create pet error:", error);
    res.status(500).json({ error: "Internal server error" });
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
    const {
      type, title, detail, date,
      reason, findings, diagnosis, treatment, recommendations,
      weight, nextControlAt, staffId,
    } = req.body ?? {};

    const pet = await prisma.pet.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!pet) {
      return res.status(404).json({ error: "Pet not found" });
    }

    const record = await createRecord(id, type || "note", title, detail, date, {
      reason: reason || null,
      findings: findings || null,
      diagnosis: diagnosis || null,
      treatment: treatment || null,
      recommendations: recommendations || null,
      weight: weight != null ? Number(weight) : null,
      nextControlAt: nextControlAt || null,
      staffId: staffId || null,
    });

    res.status(201).json({
      id: record.id,
      type: record.type,
      title: record.title,
      detail: record.detail,
      date: record.date,
      reason: record.reason,
      findings: record.findings,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      recommendations: record.recommendations,
      weight: record.weight,
      nextControlAt: record.nextControlAt,
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

router.patch("/pets/:petId/records/:recordId", async (req, res) => {
  try {
    const { petId, recordId } = req.params;
    const {
      title, detail, date,
      reason, findings, diagnosis, treatment, recommendations,
      weight, nextControlAt,
    } = req.body ?? {};

    const existing = await prisma.medicalRecord.findFirst({
      where: { id: recordId, petId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Record not found" });

    const normalizeDate = (d) => {
      if (!d) return null;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const updated = await prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        ...(title != null && { title: String(title).trim() }),
        ...(detail !== undefined && { detail: detail ? String(detail).trim() : null }),
        ...(date !== undefined && { date: normalizeDate(date) }),
        ...(reason !== undefined && { reason: reason ? String(reason).trim() : null }),
        ...(findings !== undefined && { findings: findings ? String(findings).trim() : null }),
        ...(diagnosis !== undefined && { diagnosis: diagnosis ? String(diagnosis).trim() : null }),
        ...(treatment !== undefined && { treatment: treatment ? String(treatment).trim() : null }),
        ...(recommendations !== undefined && { recommendations: recommendations ? String(recommendations).trim() : null }),
        ...(weight !== undefined && { weight: weight != null ? Number(weight) : null }),
        ...(nextControlAt !== undefined && { nextControlAt: normalizeDate(nextControlAt) }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Patch record error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/pets/:petId/records/:recordId", async (req, res) => {
  try {
    const { petId, recordId } = req.params;
    const existing = await prisma.medicalRecord.findFirst({
      where: { id: recordId, petId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Record not found" });
    await prisma.medicalRecord.delete({ where: { id: recordId } });
    await prisma.petNextAction.deleteMany({ where: { sourceRecordId: recordId } });
    res.json({ ok: true });
  } catch (error) {
    console.error("[Dashboard] Delete record error:", error.message);
    res.status(500).json({ error: "Internal server error" });
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

    const { items, nextActions } = await buildPetTimeline(id, tenantId);
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

    // Misma fuente de verdad que GET /pets/:id/timeline → el PDF nunca diverge.
    const { items, nextActions } = await buildPetTimeline(id, tenantId);

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

// Lista de recordatorios próximos (acciones pendientes) para el Inicio.
router.get("/next-actions/upcoming", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const limit = Math.min(parseInt(req.query.limit ?? "6") || 6, 50);

    const actions = await prisma.petNextAction.findMany({
      where: { ...(tenantId ? { tenantId } : {}), status: "pending" },
      orderBy: { dueAt: "asc" },
      take: limit,
      include: { pet: { select: { name: true, type: true } } },
    });

    res.json(
      actions.map((a) => ({
        id: a.id,
        type: a.type,
        notes: a.notes ?? null,
        dueAt: a.dueAt.toISOString(),
        petName: a.pet?.name ?? "Mascota",
        petType: a.pet?.type ?? null,
      }))
    );
  } catch (error) {
    console.error("[Dashboard] Upcoming next actions error:", error);
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
