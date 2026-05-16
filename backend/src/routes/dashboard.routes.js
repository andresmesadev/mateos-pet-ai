const express = require("express");
const prisma = require("../lib/prisma");

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
    const appointments = await prisma.appointment.findMany({
      orderBy: {
        date: "desc",
      },

      take: 10,
    });

    res.json(appointments);
  } catch (error) {
    console.error("[Dashboard] Appointments error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;