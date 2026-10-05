const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { bogotaMonthBounds, currentBogotaYearMonth, readReportPeriod, readReportYear, dateRange, cents, metric } = require('./report-period');

// ── Helpers ──────────────────────────────────────────────────────────────────

router.use('/reports', (req, res, next) => {
  if (!req.tenant?.tenantId) return res.status(400).json({ error: 'Selecciona un establecimiento para consultar sus reportes.' });
  next();
});
router.use(['/reports/summary', '/reports/services', '/reports/breakdown'], (req, res, next) => {
  try { req.reportPeriod = readReportPeriod(req.query); next(); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

// ── GET /reports/summary?period=month|week|year&offset=0 ──────────────────────
// Resumen general: ingresos, citas, clientes nuevos, mascotas atendidas
router.get("/reports/summary", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tf = { tenantId };
    const { current, prev, metadata } = req.reportPeriod;

    const [
      revCurrent, revPrev,
      apptCurrent, apptPrev,
      clientsCurrent, clientsPrev,
      petsCurrent, petsPrev, expenseCurrent, expensePrev, establishment,
    ] = await prisma.$transaction([
      prisma.transaction.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { ...tf, status: 'active', paidAt: dateRange(current) } }),
      prisma.transaction.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { ...tf, status: 'active', paidAt: dateRange(prev) } }),
      prisma.appointment.count({ where: { ...tf, date: dateRange(current), status: { notIn: ["cancelled", "no_show"] } } }),
      prisma.appointment.count({ where: { ...tf, date: dateRange(prev), status: { notIn: ["cancelled", "no_show"] } } }),
      prisma.user.count({ where: { ...tf, createdAt: dateRange(current) } }),
      prisma.user.count({ where: { ...tf, createdAt: dateRange(prev) } }),
      prisma.appointment.findMany({ where: { ...tf, date: dateRange(current), status: "completed" }, select: { petId: true }, distinct: ["petId"] }),
      prisma.appointment.findMany({ where: { ...tf, date: dateRange(prev), status: "completed" }, select: { petId: true }, distinct: ["petId"] }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { ...tf, status: 'active', date: dateRange(current) } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { ...tf, status: 'active', date: dateRange(prev) } }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } }),
    ], { isolationLevel: 'RepeatableRead' });

    res.json({
      ...metadata,
      establishment,
      revenue: metric(revCurrent._sum.total, revPrev._sum.total, true),
      expenses: metric(expenseCurrent._sum.amount, expensePrev._sum.amount, true),
      difference: metric((cents(revCurrent._sum.total) - cents(expenseCurrent._sum.amount)) / 100, (cents(revPrev._sum.total) - cents(expensePrev._sum.amount)) / 100, true),
      transactionCount: revCurrent._count._all,
      appointments: metric(apptCurrent, apptPrev),
      newClients: metric(clientsCurrent, clientsPrev),
      petsAttended: metric(petsCurrent.filter(pet => pet.petId).length, petsPrev.filter(pet => pet.petId).length),
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
    const tf = { tenantId };
    const bounds = req.reportPeriod.current;

    const appts = await prisma.appointment.findMany({
      where: { ...tf, date: dateRange(bounds), status: 'completed' },
      select: { serviceType: true, service: { select: { name: true } } },
    });

    const counts = new Map();
    const typeNames = new Map([['grooming', 'Peluquería'], ['veterinary', 'Veterinaria'], ['other', 'Otro servicio']]);
    for (const a of appts) {
      const key = a.service?.name || typeNames.get(a.serviceType) || a.serviceType || "Otro";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const result = [...counts.entries()]
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
    const tf = { tenantId };
    let targetYear;
    try { targetYear = readReportYear(req.query); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    const months = await Promise.all(
      Array.from({ length: 12 }, async (_, m) => {
        const bounds = bogotaMonthBounds(targetYear, m);
        const agg = await prisma.transaction.aggregate({
          _sum: { total: true },
          where: { ...tf, status: 'active', paidAt: dateRange(bounds) },
        });
        return { month: m + 1, revenue: Number(agg._sum.total ?? 0), year: targetYear };
      })
    );

    res.json(months);
  } catch (error) {
    console.error("[Reports] revenue-by-month error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Read-only breakdown of stored operations; classifications never resolve or change prices.
router.get('/reports/breakdown', async (req, res) => {
  try {
    const scope = { tenantId: req.tenant.tenantId, status: 'active', paidAt: dateRange(req.reportPeriod.current) };
    const review = { origin: 'system_appointment_completed', recordedActorId: null };
    const itemAggregate = filter => prisma.transactionItem.aggregate({
      where: { AND: [{ transaction: { is: scope } }, filter] },
      _sum: { total: true, quantity: true }, _count: { _all: true },
    });
    const [groups, pending, total, products, services, unclassified] = await prisma.$transaction([
      prisma.transaction.groupBy({ by: ['paymentMethod'], where: { ...scope, NOT: review }, _sum: { total: true }, _count: { _all: true } }),
      prisma.transaction.aggregate({ where: { ...scope, ...review }, _sum: { total: true }, _count: { _all: true } }),
      prisma.transaction.aggregate({ where: scope, _sum: { total: true }, _count: { _all: true } }),
      itemAggregate({ OR: [{ itemKind: 'product' }, { productId: { not: null } }] }),
      itemAggregate({ productId: null, OR: [{ itemKind: 'service' }, { itemKind: { notIn: ['product', 'service'] }, transaction: { is: { origin: 'system_appointment_completed' } } }] }),
      itemAggregate({ productId: null, itemKind: { notIn: ['product', 'service'] }, transaction: { is: { origin: { not: 'system_appointment_completed' } } } }),
    ], { isolationLevel: 'RepeatableRead' });
    const byMethod = new Map(['cash', 'transfer', 'card', 'other', 'review', 'unclassified'].map(method => [method, { method, count: 0, total: 0 }]));
    for (const group of groups) {
      const bucket = byMethod.get(group.paymentMethod) ?? byMethod.get('unclassified');
      bucket.count += group._count._all; bucket.total = (cents(bucket.total) + cents(group._sum.total)) / 100;
    }
    byMethod.get('review').count = pending._count._all;
    byMethod.get('review').total = Number(pending._sum.total ?? 0);
    const byKind = [['product', products], ['service', services], ['unclassified', unclassified]].map(([kind, result]) => ({ kind, total: Number(result._sum.total ?? 0), quantity: result._sum.quantity ?? 0, lines: result._count._all }));
    res.json({ ...req.reportPeriod.metadata, total: Number(total._sum.total ?? 0), count: total._count._all,
      byMethod: [...byMethod.values()], byKind,
      unallocatedTotal: (cents(total._sum.total) - byKind.reduce((sum, row) => sum + cents(row.total), 0)) / 100,
    });
  } catch (error) {
    console.error('[Reports] breakdown error:', error);
    res.status(500).json({ error: 'No se pudo consultar el desglose.' });
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
        pet: { tenantId },
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
// Actividad: clientes nuevos y cantidad de citas, no una medida de retención.
router.get("/reports/clients-retention", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tf = { tenantId };
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
