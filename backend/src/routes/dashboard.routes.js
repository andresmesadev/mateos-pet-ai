const express = require("express");
const prisma = require("../lib/prisma");
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
} = require("../services/dashboard-client.service");
const { listTenants } = require("../services/tenant.service");

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

module.exports = router;