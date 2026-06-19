const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

// GET /search?q=texto — busca propietarios y mascotas dentro del tenant
router.get("/search", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const q = String(req.query.q ?? "").trim();

    if (q.length < 2) return res.json({ users: [], pets: [] });

    const tenantFilter = tenantId ? { tenantId } : {};
    const take = 5;

    const [users, pets] = await Promise.all([
      prisma.user.findMany({
        where: {
          ...tenantFilter,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        },
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true },
      }),
      prisma.pet.findMany({
        where: {
          ...tenantFilter,
          name: { contains: q, mode: "insensitive" },
        },
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          breed: true,
          owner: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    res.json({ users, pets });
  } catch (error) {
    console.error("[Dashboard] Search error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
