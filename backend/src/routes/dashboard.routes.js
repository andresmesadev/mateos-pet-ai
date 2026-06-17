const express = require("express");
const prisma = require("../lib/prisma");
const { updatePet } = require("../services/pet.service");
const {
  listServices,
  createService,
  updateService,
  deleteService,
} = require("../services/service.service");
const {
  createStaff,
  updateStaff,
  deleteStaff,
} = require("../services/staff.service");
const {
  getPendingEscalations,
  resolveEscalation,
} = require("../services/escalation.service");
const {
  createRecord,
  getRecordsByPet,
} = require("../services/medical-record.service");
const {
  listConversations,
  getConversationMessages,
} = require("../services/dashboard-conversation.service");
const {
  listClients,
  getClientById,
  updateClient,
  listInactiveClients,
} = require("../services/dashboard-client.service");
const { sendWhatsAppMessage } = require("../services/whatsapp-api.service");
const {
  listTenants,
  getTenantById,
  createTenant,
} = require("../services/tenant.service");
const {
  isValidStatus,
  isAllowedTransition,
  autoTimestamps,
} = require("../services/appointment-status.service");
const {
  VALID_TYPES: VALID_ACTION_TYPES,
  listNextActions,
  createNextAction,
  updateNextAction,
  upsertControlFromRecord,
  createGroomingReminderIfNeeded,
  pendingActionsSummary,
  sendNextActionReminders,
} = require("../services/next-action.service");

const router = express.Router();

router.get("/tenants", async (req, res) => {
  try {
    const tenants = await listTenants();
    res.json(tenants);
  } catch (error) {
    console.error("[Dashboard] Tenants error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tenants", async (req, res) => {
  try {
    const { name, slug, phone, email, plan } = req.body ?? {};

    if (!name || !slug || !phone) {
      return res.status(400).json({ error: "name, slug y phone son requeridos" });
    }

    const tenant = await createTenant(name, slug, phone);

    if (email !== undefined) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { email: email || null, plan: plan || "free" },
      });
    }

    const created = await getTenantById(tenant.id);
    res.status(201).json(created);
  } catch (error) {
    console.error("[Dashboard] Create tenant error:", error.message);

    if (error.message.includes("Unique constraint") || error.code === "P2002") {
      return res.status(409).json({ error: "El slug o teléfono ya existe" });
    }

    if (error.message.includes("required")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            pets: true,
            appointments: true,
            conversations: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(tenant);
  } catch (error) {
    console.error("[Dashboard] Tenant detail error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, plan, active } = req.body ?? {};

    const existing = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (plan !== undefined) data.plan = String(plan).trim();
    if (active !== undefined) data.active = Boolean(active);

    const updated = await prisma.tenant.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update tenant error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const where = tenantId ? { tenantId } : {};

    const [
      users,
      pets,
      appointments,
      conversations,
    ] = await Promise.all([
      prisma.user.count({ where }),
      prisma.pet.count({ where }),
      prisma.appointment.count({ where }),
      prisma.conversation.count({ where }),
    ]);

    res.json({
      users,
      pets,
      appointments,
      conversations,
      ...(tenantId ? { tenantId } : {}),
    });
  } catch (error) {
    console.error("[Dashboard] Stats error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

function getBogotaYmd() {
  const bogota = new Date(Date.now() - 5 * 3600 * 1000);
  return bogota.toISOString().slice(0, 10);
}

function bogotaDayStart(ymd) {
  return new Date(`${ymd}T05:00:00.000Z`);
}

function mapAppointmentRow(a) {
  return {
    id: a.id,
    date: a.date,
    status: a.status,
    serviceType: a.serviceType,
    petName: a.pet?.name ?? a.petName,
    petType: a.pet?.type ?? a.petType,
    clientPhone: a.user?.phone ?? "",
    clientName: a.user?.name ?? null,
    serviceName: a.service?.name ?? null,
    staffName: a.staff?.name ?? null,
    price: a.price !== null && a.price !== undefined ? Number(a.price) : null,
    startedAt: a.startedAt?.toISOString() ?? null,
    endedAt: a.endedAt?.toISOString() ?? null,
  };
}

const APPOINTMENT_INCLUDE = {
  user: { select: { phone: true, name: true } },
  pet: { select: { name: true, type: true } },
  service: { select: { name: true } },
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

router.get("/clients/inactive-count", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const cutoff = new Date(Date.now() - 60 * 86_400_000);
    const count = await prisma.user.count({
      where: {
        ...tenantFilter,
        AND: [
          { appointments: { some: {} } },
          { appointments: { none: { date: { gte: cutoff } } } },
        ],
      },
    });
    res.json({ count });
  } catch (error) {
    console.error("[Dashboard] Inactive count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/appointments", async (req, res) => {
  try {
    const rows = await prisma.appointment.findMany({
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
    const { status, staffId, serviceId, price } = req.body ?? {};

    // Ownership check
    const existing = await prisma.appointment.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const data = {};

    // Status transition
    if (status !== undefined) {
      if (!isValidStatus(status)) {
        return res.status(400).json({ error: "Estado inválido" });
      }
      if (!isAllowedTransition(existing.status, status)) {
        return res.status(422).json({
          error: `Transición no permitida: ${existing.status} → ${status}`,
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
        if (!staff) return res.status(404).json({ error: "Staff no encontrado en este tenant" });
      }
      data.staffId = staffId || null;
    }

    // Service must belong to same tenant; copy price if not explicitly provided
    if (serviceId !== undefined) {
      if (serviceId) {
        const service = await prisma.service.findFirst({
          where: tenantId ? { id: serviceId, tenantId } : { id: serviceId },
        });
        if (!service) return res.status(404).json({ error: "Servicio no encontrado en este tenant" });
        // Auto-populate price from service if caller didn't send one and appointment has none
        if (price === undefined && existing.price === null) {
          data.price = service.price ?? null;
        }
      }
      data.serviceId = serviceId || null;
    }

    // Explicit price override (preserved as historical even if service changes later)
    if (price !== undefined) {
      data.price = price !== null ? Number(price) : null;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data,
      include: { ...APPOINTMENT_INCLUDE, service: { select: { name: true, category: true } } },
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

const VET_SERVICE_TYPES = ["vet", "consultation", "veterinary_consultation"];
const BLOCKED_STATUSES = ["cancelled", "no_show"];

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

function mapMedicalRecord(r) {
  return {
    id: r.id,
    appointmentId: r.appointmentId,
    type: r.type,
    title: r.title,
    detail: r.detail,
    date: r.date,
    reason: r.reason,
    findings: r.findings,
    diagnosis: r.diagnosis,
    treatment: r.treatment,
    recommendations: r.recommendations,
    weight: r.weight,
    nextControlAt: r.nextControlAt,
    staffId: r.staffId,
    staffName: r.staff?.name ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

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

function appointmentKind(appt) {
  if (appt.status === "cancelled") return "cancelled";
  if (appt.status === "no_show") return "no_show";
  const category = appt.service?.category?.toLowerCase() ?? null;
  const stype = appt.serviceType?.toLowerCase() ?? "";
  if (category === "veterinary" || VET_SERVICE_TYPES.includes(stype)) return "consultation";
  if (category === "grooming" || GROOMING_KEYWORDS.some((keyword) => stype.includes(keyword))) {
    return "grooming";
  }
  return "other_appt";
}

function standaloneRecordKind(record) {
  if (record.type !== "note") return record.type;

  const text = `${record.title ?? ""} ${record.detail ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (text.includes("desparasit")) return "deworming";
  if (text.includes("imagen") || text.includes("foto")) return "image";
  if (
    text.includes("examen") ||
    text.includes("laboratorio") ||
    text.includes("rayos x") ||
    text.includes("ecografia")
  ) {
    return "exam";
  }
  if (text.includes("tratamiento")) return "treatment";
  return "note";
}

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

// ── Bandeja de oportunidades (TAREA 13) ──────────────────────────────────────
router.get("/opportunities", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const now = new Date();

    // 1. Pending next-actions with pet + owner
    const actions = await prisma.petNextAction.findMany({
      where: { ...tenantFilter, status: "pending" },
      orderBy: { dueAt: "asc" },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            type: true,
            owner: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    // Group by type
    const byType = {};
    for (const a of actions) {
      const entry = {
        actionId: a.id,
        petId: a.pet.id,
        petName: a.pet.name,
        petType: a.pet.type,
        ownerId: a.pet.owner?.id ?? null,
        ownerName: a.pet.owner?.name ?? null,
        ownerPhone: a.pet.owner?.phone ?? null,
        dueAt: a.dueAt,
        notes: a.notes,
        isOverdue: a.dueAt < now,
      };
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(entry);
    }

    // 2. Inactive clients (no appointment ≥ 60 days)
    const cutoff = new Date(Date.now() - 60 * 86_400_000);
    const inactiveUsers = await prisma.user.findMany({
      where: {
        ...tenantFilter,
        AND: [
          { appointments: { some: {} } },
          { appointments: { none: { date: { gte: cutoff } } } },
        ],
      },
      include: {
        pets: {
          select: { id: true, name: true, type: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        appointments: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const inactive = inactiveUsers.map((u) => {
      const lastDate = u.appointments[0]?.date ?? null;
      const daysSince = lastDate
        ? Math.floor((now - new Date(lastDate)) / 86_400_000)
        : null;
      return {
        ownerId: u.id,
        ownerName: u.name ?? null,
        ownerPhone: u.phone,
        pets: u.pets,
        lastAppointmentDate: lastDate,
        daysSince,
      };
    });

    res.json({ byType, inactive });
  } catch (error) {
    console.error("[Dashboard] Opportunities error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/escalations", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const escalations = await getPendingEscalations(tenantId);
    res.json(escalations);
  } catch (error) {
    console.error("[Dashboard] Escalations error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/escalations/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = await resolveEscalation(id);

    if (!resolved) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    res.json(resolved);
  } catch (error) {
    console.error("[Dashboard] Resolve escalation error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const result = await listConversations({ ...req.query, tenantId: tenantId ?? undefined });
    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Conversations error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getConversationMessages(id);

    if (!result) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Conversation messages error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/clients", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const clients = await listClients(tenantId);
    res.json(clients);
  } catch (error) {
    console.error("[Dashboard] Clients error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const client = await getClientById(id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    res.json(client);
  } catch (error) {
    console.error("[Dashboard] Client detail error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/services", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const rows = await prisma.service.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json(rows);
  } catch (error) {
    console.error("[Dashboard] Services error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/services", async (req, res) => {
  try {
    const { name, category, duration, requiresAppointment } = req.body ?? {};
    const { tenantId } = req.tenant;

    // Validate name
    if (!name || typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ error: "name es requerido y debe tener entre 1 y 100 caracteres" });
    }
    // Validate category
    const validCategories = ["veterinary", "grooming", "other"];
    if (!category || !validCategories.includes(String(category))) {
      return res.status(400).json({ error: "category debe ser veterinary, grooming u other" });
    }
    // Validate duration
    const durationNum = Number(duration);
    if (!duration || !Number.isInteger(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: "duration debe ser un entero positivo" });
    }

    // Check for duplicate name in same tenant
    const existing = await prisma.service.findFirst({
      where: { name: name.trim(), tenantId: tenantId ?? null },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: "Ya existe un servicio con ese nombre en este tenant" });
    }

    const service = await createService(tenantId ?? null, {
      name: name.trim(),
      category: String(category).trim(),
      duration: durationNum,
      requiresAppointment: requiresAppointment !== false,
    });
    res.status(201).json(service);
  } catch (error) {
    console.error("[Dashboard] Create service error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, isSuperAdmin } = req.tenant;
    const { name, category, duration, requiresAppointment, active } = req.body ?? {};

    // Verify ownership (unless super admin with no tenant filter)
    if (!isSuperAdmin || tenantId) {
      const owned = await prisma.service.findFirst({
        where: { id, tenantId: tenantId ?? null },
        select: { id: true },
      });
      if (!owned) {
        return res.status(404).json({ error: "Service not found" });
      }
    }

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (category !== undefined) data.category = String(category).trim();
    if (duration !== undefined) data.duration = Number(duration);
    if (requiresAppointment !== undefined) data.requiresAppointment = Boolean(requiresAppointment);
    if (active !== undefined) data.active = Boolean(active);
    const updated = await updateService(id, data);
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update service error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Service not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, isSuperAdmin } = req.tenant;

    // Verify ownership (unless super admin with no tenant filter)
    if (!isSuperAdmin || tenantId) {
      const owned = await prisma.service.findFirst({
        where: { id, tenantId: tenantId ?? null },
        select: { id: true },
      });
      if (!owned) {
        return res.status(404).json({ error: "Service not found" });
      }
    }

    await deleteService(id);
    res.status(204).end();
  } catch (error) {
    console.error("[Dashboard] Delete service error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Service not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

const VALID_ROLES = ["vet", "groomer", "admin"];

router.get("/staff", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const rows = await prisma.staff.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    res.json(rows);
  } catch (error) {
    console.error("[Dashboard] Staff error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, role, phone, email } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name es requerido" });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
    }

    const member = await createStaff(tenantId ?? null, {
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
    });
    res.status(201).json(member);
  } catch (error) {
    console.error("[Dashboard] Create staff error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const { name, role, phone, email, active } = req.body ?? {};

    const existing = await prisma.staff.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
      }
      data.role = role;
    }
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (active !== undefined) data.active = Boolean(active);

    const updated = await updateStaff(id, data);
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update staff error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Staff not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const existing = await prisma.staff.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    await deleteStaff(id);
    res.status(204).end();
  } catch (error) {
    console.error("[Dashboard] Delete staff error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Staff not found" });
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

router.get("/clients/inactive", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const clients = await listInactiveClients(tenantId);
    res.json(clients);
  } catch (error) {
    console.error("[Dashboard] Inactive clients error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/campaigns/reactivation", async (req, res) => {
  try {
    const { clientIds, message } = req.body ?? {};

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ error: "clientIds es requerido" });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message es requerido" });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, phone: true, name: true },
    });

    let sent = 0;
    let failed = 0;

    const now = new Date();
    for (const user of users) {
      const text = message.replace(/\{nombre\}/g, user.name ?? "cliente");
      const result = await sendWhatsAppMessage(user.phone, text);
      if (result) {
        sent++;
        await prisma.user.update({ where: { id: user.id }, data: { lastReminderSentAt: now } });
      } else {
        failed++;
      }
    }

    res.json({ sent, failed, total: users.length });
  } catch (error) {
    console.error("[Dashboard] Reactivation campaign error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Automatizaciones — envío masivo por tipo de acción (TAREA 14) ────────────
router.post("/campaigns/next-actions", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { type } = req.body ?? {};
    if (!type) return res.status(400).json({ error: "type es requerido" });
    const result = await sendNextActionReminders({ tenantId, type });
    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Next-action campaign error:", error.message);
    if (error.message.includes("inválido")) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, address, notes } = req.body ?? {};
    const updated = await updateClient(id, { name, email, address, notes });
    res.json({ id: updated.id, name: updated.name, email: updated.email, address: updated.address, notes: updated.notes });
  } catch (error) {
    console.error("[Dashboard] Update client error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Client not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Métricas de recuperación (TAREA 15) ───────────────────────────────────────
router.get("/metrics/recovery", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    // ── Reactivación de clientes ──────────────────────────────────────────────
    // Clientes a quienes se envió recordatorio
    const contactedUsers = await prisma.user.findMany({
      where: { ...tenantFilter, lastReminderSentAt: { not: null } },
      select: { id: true, lastReminderSentAt: true },
    });

    // De esos, cuántos tienen al menos una cita posterior a lastReminderSentAt
    let reactivatedCount = 0;
    for (const u of contactedUsers) {
      const appt = await prisma.appointment.findFirst({
        where: {
          userId: u.id,
          date: { gt: u.lastReminderSentAt },
          status: { notIn: ["cancelled", "no_show"] },
        },
        select: { id: true },
      });
      if (appt) reactivatedCount++;
    }

    const contactedCount = contactedUsers.length;
    const reactivationRate = contactedCount > 0
      ? Math.round((reactivatedCount / contactedCount) * 100)
      : 0;

    // ── Acciones cerradas tras recordatorio ───────────────────────────────────
    const remindedActions = await prisma.petNextAction.count({
      where: { ...tenantFilter, reminderSentAt: { not: null } },
    });
    const closedAfterReminder = await prisma.petNextAction.count({
      where: { ...tenantFilter, reminderSentAt: { not: null }, status: "done" },
    });
    const actionCloseRate = remindedActions > 0
      ? Math.round((closedAfterReminder / remindedActions) * 100)
      : 0;

    res.json({
      reactivation: {
        contacted: contactedCount,
        reactivated: reactivatedCount,
        rate: reactivationRate,
      },
      nextActions: {
        reminded: remindedActions,
        closed: closedAfterReminder,
        rate: actionCloseRate,
      },
    });
  } catch (error) {
    console.error("[Dashboard] Recovery metrics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/metrics", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

    // Month boundaries in Bogotá (UTC-5)
    const bogotaNow = new Date(now.getTime() - 5 * 3600 * 1000);
    const y = bogotaNow.getUTCFullYear();
    const m = bogotaNow.getUTCMonth();
    const thisMonthStart = new Date(Date.UTC(y, m, 1, 5, 0, 0));
    const prevMonthStart = new Date(Date.UTC(y, m - 1, 1, 5, 0, 0));

    const [
      apptThisWeek,
      apptPrevWeek,
      confirmedThisWeek,
      confirmedPrevWeek,
      clientsThisMonth,
      clientsPrevMonth,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { ...tenantFilter, date: { gte: weekAgo } },
      }),
      prisma.appointment.count({
        where: { ...tenantFilter, date: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.appointment.count({
        where: { ...tenantFilter, date: { gte: weekAgo }, status: "confirmed" },
      }),
      prisma.appointment.count({
        where: {
          ...tenantFilter,
          date: { gte: twoWeeksAgo, lt: weekAgo },
          status: "confirmed",
        },
      }),
      prisma.user.count({
        where: { ...tenantFilter, createdAt: { gte: thisMonthStart } },
      }),
      prisma.user.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: prevMonthStart, lt: thisMonthStart },
        },
      }),
    ]);

    const rate = apptThisWeek > 0 ? Math.round((confirmedThisWeek / apptThisWeek) * 100) : 0;
    const prevRate = apptPrevWeek > 0 ? Math.round((confirmedPrevWeek / apptPrevWeek) * 100) : 0;

    res.json({
      appointmentsThisWeek: {
        count: apptThisWeek,
        prev: apptPrevWeek,
        delta: apptThisWeek - apptPrevWeek,
      },
      confirmationRate: {
        rate,
        prev: prevRate,
        delta: rate - prevRate,
      },
      newClientsThisMonth: {
        count: clientsThisMonth,
        prev: clientsPrevMonth,
        delta: clientsThisMonth - clientsPrevMonth,
      },
    });
  } catch (error) {
    console.error("[Dashboard] Metrics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
