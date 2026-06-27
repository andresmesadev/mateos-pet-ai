const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const ERRORS = require("../../constants/errors");
const {
  getBogotaYmd,
  bogotaDayStart,
  APPOINTMENT_INCLUDE,
  mapAppointmentRow,
  mapMedicalRecord,
} = require("./shared");
const {
  isValidStatus,
  isAllowedTransition,
  autoTimestamps,
} = require("../../services/appointment-status.service");
const {
  createRecord,
  getRecordsByPet,
} = require("../../services/medical-record.service");
const { listInactiveClients } = require("../../services/dashboard-client.service");
const {
  upsertControlFromRecord,
  createGroomingReminderIfNeeded,
} = require("../../services/next-action.service");

const VET_SERVICE_TYPES = ["vet", "consultation", "veterinary_consultation"];
const BLOCKED_STATUSES = ["cancelled", "no_show"];
const GROOMING_TYPES = [
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

async function resolveVetAppointment(id, tenantId) {
  const where = tenantId ? { id, tenantId } : { id };
  const appt = await prisma.appointment.findFirst({
    where,
    include: {
      service: { select: { category: true } },
      pet: { select: { id: true, weight: true } },
    },
  });
  return appt;
}

function validateVetAppointment(appt) {
  if (!appt) return { status: 404, error: "Cita no encontrada" };
  if (!appt.petId) return { status: 422, error: "La cita no tiene mascota asociada" };
  if (BLOCKED_STATUSES.includes(appt.status)) {
    return { status: 422, error: `No se puede registrar atención en una cita ${appt.status}` };
  }
  const isVet = appt.serviceId
    ? appt.service?.category === "veterinary"
    : VET_SERVICE_TYPES.includes(appt.serviceType?.toLowerCase());
  if (!isVet) {
    return { status: 422, error: "Solo se puede registrar atención clínica en citas veterinarias" };
  }
  return null;
}

const MEDICAL_RECORD_INCLUDE = {
  staff: { select: { name: true } },
};

router.get("/appointments/today", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const ymd = getBogotaYmd();
    const start = bogotaDayStart(ymd);
    const end = new Date(start.getTime() + 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: { ...tenantFilter, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      include: APPOINTMENT_INCLUDE,
    });

    res.json(rows.map(mapAppointmentRow));
  } catch (error) {
    console.error("[Dashboard] Today appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/appointments/upcoming", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const ymd = getBogotaYmd();
    const todayEnd = new Date(bogotaDayStart(ymd).getTime() + 86_400_000);
    const weekEnd = new Date(todayEnd.getTime() + 6 * 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: {
        ...tenantFilter,
        date: { gte: todayEnd, lt: weekEnd },
        status: { not: "cancelled" },
      },
      orderBy: { date: "asc" },
      take: 30,
      include: APPOINTMENT_INCLUDE,
    });

    res.json(rows.map(mapAppointmentRow));
  } catch (error) {
    console.error("[Dashboard] Upcoming appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /appointments/week?date=YYYY-MM-DD  (defaults to current Bogotá week Mon–Sun)
router.get("/appointments/week", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    // Resolve anchor date (Bogotá)
    const anchor = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : getBogotaYmd();

    // Find Monday of the anchor's week
    const anchorDate = new Date(`${anchor}T12:00:00.000Z`);
    const dow = anchorDate.getUTCDay(); // 0=Sun
    const daysToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(anchorDate.getTime() + daysToMon * 86_400_000);
    const mondayYmd = monday.toISOString().slice(0, 10);

    const weekStart = bogotaDayStart(mondayYmd);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: {
        ...tenantFilter,
        date: { gte: weekStart, lt: weekEnd },
      },
      orderBy: { date: "asc" },
      include: APPOINTMENT_INCLUDE,
    });

    res.json({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      mondayYmd,
      appointments: rows.map(mapAppointmentRow),
    });
  } catch (error) {
    console.error("[Dashboard] Week appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/inactive-count", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const clients = await listInactiveClients(tenantId);
    res.json({ count: clients.length });
  } catch (error) {
    console.error("[Dashboard] Inactive count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/appointments", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const rows = await prisma.appointment.findMany({
      where: tenantFilter,
      orderBy: {
        date: "desc",
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      take: 10,
    });

    const appointments = rows.map((appointment) => ({
      id: appointment.id,
      userId: appointment.userId,
      petId: appointment.petId,
      petName: appointment.pet?.name ?? appointment.petName,
      petType: appointment.pet?.type ?? appointment.petType,
      serviceType: appointment.serviceType,
      date: appointment.date,
      status: appointment.status,
      createdAt: appointment.createdAt,
      pet: appointment.pet,
    }));

    res.json(appointments);
  } catch (error) {
    console.error("[Dashboard] Appointments error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const { status, staffId, serviceId, finalPrice } = req.body ?? {};

    // Ownership check
    const existing = await prisma.appointment.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!existing) return res.status(404).json({ error: ERRORS.NOT_FOUND("Cita") });

    const data = {};

    // Status transition
    if (status !== undefined) {
      if (!isValidStatus(status)) {
        return res.status(400).json({ error: ERRORS.INVALID_STATUS });
      }
      if (!isAllowedTransition(existing.status, status)) {
        return res.status(422).json({
          error: ERRORS.TRANSITION_NOT_ALLOWED(existing.status, status),
        });
      }
      data.status = status;
      Object.assign(data, autoTimestamps(existing.status, status));
    }

    // Staff must belong to same tenant
    if (staffId !== undefined) {
      if (staffId) {
        const staff = await prisma.staff.findFirst({
          where: tenantId ? { id: staffId, tenantId } : { id: staffId },
        });
        if (!staff) return res.status(404).json({ error: ERRORS.STAFF_NOT_FOUND });
      }
      data.staffId = staffId || null;
    }

    // Service must belong to same tenant
    if (serviceId !== undefined) {
      if (serviceId) {
        const service = await prisma.service.findFirst({
          where: tenantId ? { id: serviceId, tenantId } : { id: serviceId },
        });
        if (!service) return res.status(404).json({ error: ERRORS.SERVICE_NOT_FOUND });
      }
      data.serviceId = serviceId || null;
    }

    // Manual override: only store finalPrice when operator explicitly provides it.
    // Effective price at display time is resolved by price-resolver.service via mapAppointmentRow.
    if (finalPrice !== undefined) {
      data.finalPrice = finalPrice !== null ? Number(finalPrice) : null;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data,
      include: APPOINTMENT_INCLUDE,
    });

    // Auto-create grooming reminder when a grooming appointment completes
    if (data.status === "completed" && updated.petId) {
      const category = updated.service?.category;
      const stype = updated.serviceType?.toLowerCase() ?? "";
      const isGrooming = category === "grooming" || GROOMING_TYPES.includes(stype);
      if (isGrooming) {
        await createGroomingReminderIfNeeded({
          petId: updated.petId,
          tenantId: updated.tenantId,
          appointmentId: updated.id,
          appointmentDate: updated.date,
        }).catch((err) => console.error("[NextAction] Grooming reminder error:", err));
      }
    }

    res.json(mapAppointmentRow(updated));
  } catch (error) {
    console.error("[Dashboard] Patch appointment error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ────────────────────────────────────────────────────────────
// Vet appointment medical record (TAREA 10)
// ────────────────────────────────────────────────────────────

router.get("/appointments/:id/medical-record", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const appt = await resolveVetAppointment(id, tenantId);
    if (!appt) return res.status(404).json({ error: "Cita no encontrada" });

    const record = await prisma.medicalRecord.findUnique({
      where: { appointmentId: id },
      include: MEDICAL_RECORD_INCLUDE,
    });

    if (!record) return res.status(404).json({ error: "Sin registro de atención" });
    res.json(mapMedicalRecord(record));
  } catch (error) {
    console.error("[Dashboard] GET medical-record error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/appointments/:id/medical-record", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const {
      reason, findings, diagnosis, treatment, recommendations,
      weight, nextControlAt, staffId,
    } = req.body ?? {};

    const appt = await resolveVetAppointment(id, tenantId);
    const validationError = validateVetAppointment(appt);
    if (validationError) {
      return res.status(validationError.status).json({ error: validationError.error });
    }

    // Staff must belong to same tenant
    if (staffId) {
      const staffMember = await prisma.staff.findFirst({
        where: tenantId ? { id: staffId, tenantId } : { id: staffId },
      });
      if (!staffMember) {
        return res.status(404).json({ error: "Profesional no encontrado en este tenant" });
      }
    }

    const recordData = {
      petId: appt.petId,
      appointmentId: id,
      type: "consultation",
      title: "Consulta veterinaria",
      date: appt.date,
      staffId: staffId ?? null,
      reason: reason?.trim() || null,
      findings: findings?.trim() || null,
      diagnosis: diagnosis?.trim() || null,
      treatment: treatment?.trim() || null,
      recommendations: recommendations?.trim() || null,
      weight: weight !== undefined && weight !== null ? Number(weight) : undefined,
      nextControlAt: nextControlAt ? new Date(nextControlAt) : null,
    };

    // Strip undefined so Prisma doesn't complain on create vs update
    const createData = Object.fromEntries(
      Object.entries(recordData).filter(([, v]) => v !== undefined)
    );
    const updateData = Object.fromEntries(
      Object.entries(recordData).filter(([, v]) => v !== undefined)
    );

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.upsert({
        where: { appointmentId: id },
        create: createData,
        update: updateData,
        include: MEDICAL_RECORD_INCLUDE,
      });

      // Update Pet.weight with the most recent measurement
      if (weight !== undefined && weight !== null) {
        await tx.pet.update({
          where: { id: appt.petId },
          data: { weight: Number(weight) },
        });
      }

      return record;
    });

    // Auto-upsert "control" next action when nextControlAt is set
    await upsertControlFromRecord({
      petId: appt.petId,
      tenantId: appt.tenantId,
      recordId: result.id,
      dueAt: nextControlAt ? new Date(nextControlAt) : null,
      notes: result.diagnosis ? `Seguimiento: ${result.diagnosis}` : null,
    }).catch((err) => console.error("[NextAction] Control upsert error:", err));

    res.json(mapMedicalRecord(result));
  } catch (error) {
    console.error("[Dashboard] PUT medical-record error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
