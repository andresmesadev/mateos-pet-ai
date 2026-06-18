const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { getBogotaYmd, bogotaDayStart, mapTransaction } = require("./shared");

// ── POS / Facturación (TAREA 17) ──────────────────────────────────────────────

const VALID_PAYMENT_METHODS = ["cash", "transfer", "card", "other"];

const TRANSACTION_INCLUDE = {
  user: { select: { id: true, name: true, phone: true } },
  pet:  { select: { id: true, name: true, type: true } },
  appointment: { select: { id: true, serviceType: true, date: true } },
  items: { orderBy: { id: "asc" } },
};

// POST /transactions — crear cobro
router.post("/transactions", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { userId, petId, appointmentId, paymentMethod, notes, paidAt, items } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items es requerido (al menos uno)" });
    }
    if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: `paymentMethod inválido. Valores: ${VALID_PAYMENT_METHODS.join(", ")}` });
    }

    // Validate items
    for (const item of items) {
      if (!item.description?.trim()) return res.status(400).json({ error: "Cada ítem debe tener descripción" });
      if (typeof item.unitPrice !== "number" || item.unitPrice < 0) return res.status(400).json({ error: "unitPrice inválido" });
      const qty = item.quantity ?? 1;
      if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: "quantity debe ser entero positivo" });
    }

    // Tenant-check userId if provided
    if (userId) {
      const user = await prisma.user.findFirst({ where: { id: userId, ...(tenantId ? { tenantId } : {}) }, select: { id: true } });
      if (!user) return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Tenant-check appointmentId if provided
    if (appointmentId) {
      const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, ...(tenantId ? { tenantId } : {}) }, select: { id: true } });
      if (!appt) return res.status(404).json({ error: "Cita no encontrada" });
    }

    const computedItems = items.map((item) => {
      const qty = item.quantity ?? 1;
      const unitPrice = Number(item.unitPrice);
      return { description: item.description.trim(), quantity: qty, unitPrice, total: qty * unitPrice };
    });
    const total = computedItems.reduce((s, i) => s + i.total, 0);

    const tx = await prisma.transaction.create({
      data: {
        tenantId: tenantId ?? null,
        userId: userId ?? null,
        petId: petId ?? null,
        appointmentId: appointmentId ?? null,
        total,
        paymentMethod: paymentMethod ?? "cash",
        notes: notes?.trim() || null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        items: { create: computedItems },
      },
      include: TRANSACTION_INCLUDE,
    });

    res.status(201).json(mapTransaction(tx));
  } catch (error) {
    console.error("[Dashboard] Create transaction error:", error);
    if (error.code === "P2002") return res.status(409).json({ error: "Esta cita ya tiene un cobro registrado" });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /transactions — list (date range optional: ?from=YYYY-MM-DD&to=YYYY-MM-DD)
router.get("/transactions", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const { from, to } = req.query;

    const dateFilter = {};
    if (from) dateFilter.gte = bogotaDayStart(from);
    if (to) dateFilter.lt = new Date(bogotaDayStart(to).getTime() + 86_400_000);

    const rows = await prisma.transaction.findMany({
      where: {
        ...tenantFilter,
        ...(Object.keys(dateFilter).length ? { paidAt: dateFilter } : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 200,
      include: TRANSACTION_INCLUDE,
    });

    res.json(rows.map(mapTransaction));
  } catch (error) {
    console.error("[Dashboard] List transactions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /transactions/:id
router.get("/transactions/:id", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { id } = req.params;
    const tenantFilter = tenantId ? { tenantId } : {};

    const tx = await prisma.transaction.findFirst({
      where: { id, ...tenantFilter },
      include: TRANSACTION_INCLUDE,
    });
    if (!tx) return res.status(404).json({ error: "Not found" });
    res.json(mapTransaction(tx));
  } catch (error) {
    console.error("[Dashboard] Get transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /metrics/revenue?period=YYYY-MM — resumen mensual por descripción de ítem y método de pago
router.get("/metrics/revenue", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    // Resolve period (default: current Bogotá month)
    const bogotaToday = getBogotaYmd();
    const period = typeof req.query.period === "string" && /^\d{4}-\d{2}$/.test(req.query.period)
      ? req.query.period
      : bogotaToday.slice(0, 7);

    const [year, month] = period.split("-").map(Number);
    const periodStart = bogotaDayStart(`${period}-01`);
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const periodEnd = bogotaDayStart(nextMonth);

    // Previous period for comparison
    const prevMonth = month === 1 ? `${year - 1}-12-01` : `${year}-${String(month - 1).padStart(2, "0")}-01`;
    const prevStart = bogotaDayStart(prevMonth);

    const [txCurrent, txPrev] = await Promise.all([
      prisma.transaction.findMany({
        where: { ...tenantFilter, paidAt: { gte: periodStart, lt: periodEnd } },
        include: { items: true },
      }),
      prisma.transaction.findMany({
        where: { ...tenantFilter, paidAt: { gte: prevStart, lt: periodStart } },
        select: { total: true },
      }),
    ]);

    const totalCurrent = txCurrent.reduce((s, t) => s + Number(t.total), 0);
    const totalPrev = txPrev.reduce((s, t) => s + Number(t.total), 0);

    // Breakdown by item description
    const byItem = {};
    for (const tx of txCurrent) {
      for (const item of tx.items) {
        const key = item.description;
        if (!byItem[key]) byItem[key] = { description: key, quantity: 0, total: 0 };
        byItem[key].quantity += item.quantity;
        byItem[key].total += Number(item.total);
      }
    }

    // Breakdown by payment method
    const byMethod = {};
    for (const tx of txCurrent) {
      const m = tx.paymentMethod;
      if (!byMethod[m]) byMethod[m] = { method: m, count: 0, total: 0 };
      byMethod[m].count++;
      byMethod[m].total += Number(tx.total);
    }

    res.json({
      period,
      totalCurrent: Math.round(totalCurrent),
      totalPrev: Math.round(totalPrev),
      delta: Math.round(totalCurrent - totalPrev),
      transactionCount: txCurrent.length,
      byItem: Object.values(byItem).sort((a, b) => b.total - a.total),
      byMethod: Object.values(byMethod).sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    console.error("[Dashboard] Revenue metrics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
