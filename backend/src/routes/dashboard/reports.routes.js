const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

// ── Helpers ──────────────────────────────────────────────────────────────────

function bogotaMonthBounds(year, month) {
  // month: 0-based. Returns UTC Date objects marking start/end of that month in Bogotá (UTC-5)
  const start = new Date(Date.UTC(year, month, 1, 5, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 5, 0, 0));
  return { start, end };
}

function bogotaYearBounds(year) {
  const start = new Date(Date.UTC(year, 0, 1, 5, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 5, 0, 0));
  return { start, end };
}

function bogotaWeekBounds(offset = 0) {
  const now = new Date();
  const bogota = new Date(now.getTime() - 5 * 3600_000);
  const day = bogota.getUTCDay(); // 0=Sun
  const monday = new Date(bogota);
  monday.setUTCDate(bogota.getUTCDate() - ((day + 6) % 7) + offset * 7);
  const start = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 5, 0, 0));
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { start, end };
}

function currentBogotaYearMonth() {
  const bogota = new Date(new Date().getTime() - 5 * 3600_000);
  return { year: bogota.getUTCFullYear(), month: bogota.getUTCMonth() };
}

// ── GET /reports/summary?period=month|week|year&offset=0 ──────────────────────
// Resumen general: ingresos, citas, clientes nuevos, mascotas atendidas
router.get("/reports/summary", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tf = tenantId ? { tenantId } : {};
    const period = req.query.period ?? "month";
    const offset = parseInt(req.query.offset ?? "0") || 0;

    const { year, month } = currentBogotaYearMonth();

    let current, prev;
    if (period === "week") {
      current = bogotaWeekBounds(offset);
      prev = bogotaWeekBounds(offset - 1);
    } else if (period === "year") {
      current = bogotaYearBounds(year + offset);
      prev = bogotaYearBounds(year + offset - 1);
    } else {
      const m = ((month + offset) % 12 + 12) % 12;
      const y = year + Math.floor((month + offset) / 12);
      current = bogotaMonthBounds(y, m);
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      prev = bogotaMonthBounds(py, pm);
    }

    const dateRange = (bounds) => ({ gte: bounds.start, lt: bounds.end });

    const [
      revCurrent, revPrev,
      apptCurrent, apptPrev,
      clientsCurrent, clientsPrev,
      petsCurrent, petsPrev,
    ] = await Promise.all([
      prisma.transaction.aggregate({ _sum: { total: true }, where: { ...tf, paidAt: dateRange(current) } }),
      prisma.transaction.aggregate({ _sum: { total: true }, where: { ...tf, paidAt: dateRange(prev) } }),
      prisma.appointment.count({ where: { ...tf, date: dateRange(current), status: { notIn: ["cancelled", "no_show"] } } }),
      prisma.appointment.count({ where: { ...tf, date: dateRange(prev), status: { notIn: ["cancelled", "no_show"] } } }),
      prisma.user.count({ where: { ...tf, createdAt: dateRange(current) } }),
      prisma.user.count({ where: { ...tf, createdAt: dateRange(prev) } }),
      prisma.appointment.findMany({ where: { ...tf, date: dateRange(current), status: "completed" }, select: { petId: true }, distinct: ["petId"] }),
      prisma.appointment.findMany({ where: { ...tf, date: dateRange(prev), status: "completed" }, select: { petId: true }, distinct: ["petId"] }),
    ]);

    const m = (val, p) => ({ value: val, prev: p, delta: val - p, pct: p > 0 ? Math.round(((val - p) / p) * 100) : null });

    res.json({
      period,
      offset,
      rangeStart: current.start,
      rangeEnd: current.end,
      revenue: m(Number(revCurrent._sum.total ?? 0), Number(revPrev._sum.total ?? 0)),
      appointments: m(apptCurrent, apptPrev),
      newClients: m(clientsCurrent, clientsPrev),
      petsAttended: m(petsCurrent.length, petsPrev.length),
    });
  } catch (error) {
    console.error("[Reports] summary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /reports/services?period=month&offset=0 ───────────────────────────────
// Servicios más atendidos en el período
router.get("/reports/services", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tf = tenantId ? { tenantId } : {};
    const period = req.query.period ?? "month";
    const offset = parseInt(req.query.offset ?? "0") || 0;
    const { year, month } = currentBogotaYearMonth();

    let bounds;
    if (period === "week") bounds = bogotaWeekBounds(offset);
    else if (period === "year") bounds = bogotaYearBounds(year + offset);
    else {
      const m = ((month + offset) % 12 + 12) % 12;
      const y = year + Math.floor((month + offset) / 12);
      bounds = bogotaMonthBounds(y, m);
    }

    const appts = await prisma.appointment.findMany({
      where: { ...tf, date: { gte: bounds.start, lt: bounds.end }, status: { notIn: ["cancelled", "no_show"] } },
      select: { serviceType: true, service: { select: { name: true } } },
    });

    const counts = {};
    for (const a of appts) {
      const key = a.service?.name || a.serviceType || "Otro";
      counts[key] = (counts[key] ?? 0) + 1;
    }

    const result = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json(result);
  } catch (error) {
    console.error("[Reports] services error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /reports/revenue-by-month?year=2026 ──────────────────────────────────
// Ingresos mes a mes para el año dado (para el gráfico de barras)
router.get("/reports/revenue-by-month", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tf = tenantId ? { tenantId } : {};
    const { year } = currentBogotaYearMonth();
    const targetYear = parseInt(req.query.year ?? year) || year;

    const months = await Promise.all(
      Array.from({ length: 12 }, async (_, m) => {
        const bounds = bogotaMonthBounds(targetYear, m);
        const agg = await prisma.transaction.aggregate({
          _sum: { total: true },
          where: { ...tf, paidAt: { gte: bounds.start, lt: bounds.end } },
        });
        return { month: m + 1, revenue: Number(agg._sum.total ?? 0) };
      })
    );

    res.json(months);
  } catch (error) {
    console.error("[Reports] revenue-by-month error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /reports/upcoming-reminders ──────────────────────────────────────────
// Próximas fechas críticas: vacunas, desparasitaciones, peluquería (nextControlAt)
router.get("/reports/upcoming-reminders", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const days = Math.min(parseInt(req.query.days ?? "30") || 30, 90);
    const now = new Date();
    const until = new Date(now.getTime() + days * 86_400_000);

    const records = await prisma.medicalRecord.findMany({
      where: {
        ...(tenantId ? { pet: { tenantId } } : {}),
        nextControlAt: { gte: now, lte: until },
        reminderSent: false,
        type: { in: ["vaccine", "deworming", "grooming"] },
      },
      include: {
        pet: { select: { name: true, owner: { select: { name: true, phone: true } } } },
      },
      orderBy: { nextControlAt: "asc" },
      take: 50,
    });

    const TYPE_LABELS = { vaccine: "Vacuna", deworming: "Desparasitación", grooming: "Peluquería" };

    res.json(records.map((r) => ({
      id: r.id,
      type: r.type,
      typeLabel: TYPE_LABELS[r.type] ?? r.type,
      title: r.title,
      nextControlAt: r.nextControlAt,
      petName: r.pet?.name ?? "—",
      ownerName: r.pet?.owner?.name ?? "—",
      ownerPhone: r.pet?.owner?.phone ?? "—",
    })));
  } catch (error) {
    console.error("[Reports] upcoming-reminders error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /reports/clients-retention ───────────────────────────────────────────
// Clientes nuevos vs recurrentes en los últimos 6 meses
router.get("/reports/clients-retention", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tf = tenantId ? { tenantId } : {};
    const { year, month } = currentBogotaYearMonth();

    const months = await Promise.all(
      Array.from({ length: 6 }, async (_, i) => {
        const idx = month - 5 + i;
        const m = ((idx % 12) + 12) % 12;
        const y = year + Math.floor(idx / 12);
        const bounds = bogotaMonthBounds(y, m);

        const [newClients, totalAppts] = await Promise.all([
          prisma.user.count({ where: { ...tf, createdAt: { gte: bounds.start, lt: bounds.end } } }),
          prisma.appointment.count({
            where: {
              ...tf,
              date: { gte: bounds.start, lt: bounds.end },
              status: { notIn: ["cancelled", "no_show"] },
            },
          }),
        ]);

        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return { label: `${monthNames[m]} ${y}`, newClients, returningVisits: totalAppts };
      })
    );

    res.json(months);
  } catch (error) {
    console.error("[Reports] clients-retention error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
