const express = require("express");
const prisma = require("../lib/prisma");
const { updatePet } = require("../services/pet.service");
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
} = require("../services/dashboard-client.service");
const {
  listTenants,
  getTenantById,
  createTenant,
} = require("../services/tenant.service");

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
    const { tenantId } = req.query;
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
  };
}

const APPOINTMENT_INCLUDE = {
  user: { select: { phone: true, name: true } },
  pet: { select: { name: true, type: true } },
};

router.get("/appointments/today", async (req, res) => {
  try {
    const ymd = getBogotaYmd();
    const start = bogotaDayStart(ymd);
    const end = new Date(start.getTime() + 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: { date: { gte: start, lt: end } },
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
    const ymd = getBogotaYmd();
    const todayEnd = new Date(bogotaDayStart(ymd).getTime() + 86_400_000);
    const weekEnd = new Date(todayEnd.getTime() + 6 * 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: {
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
    const cutoff = new Date(Date.now() - 60 * 86_400_000);
    const count = await prisma.user.count({
      where: {
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

router.get("/pets", async (req, res) => {
  try {
    const pets = await prisma.pet.findMany({
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

    const records = await getRecordsByPet(id);

    res.json(
      records.map((record) => ({
        id: record.id,
        type: record.type,
        title: record.title,
        detail: record.detail,
        date: record.date,
        createdAt: record.createdAt,
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

router.get("/escalations", async (req, res) => {
  try {
    const escalations = await getPendingEscalations();
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
    const result = await listConversations(req.query);
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
    const clients = await listClients();
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

module.exports = router;