const express = require("express");
const prisma = require("../lib/prisma");
const {
  getPendingEscalations,
  resolveEscalation,
} = require("../services/escalation.service");

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const [
      users,
      pets,
      appointments,
      conversations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.pet.count(),
      prisma.appointment.count(),
      prisma.conversation.count(),
    ]);

    res.json({
      users,
      pets,
      appointments,
      conversations,
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

module.exports = router;