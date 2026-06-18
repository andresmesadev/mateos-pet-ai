const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { getBogotaYmd, bogotaDayStart } = require("./shared");

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

// ── TAREA 22: Predicción de churn ─────────────────────────────────────────────
// GET /metrics/churn?limit=50
// Identifica clientes en riesgo basándose en frecuencia histórica de visitas.
// Requiere >= 2 citas completadas para calcular intervalo promedio.
// overdueRatio = daysSinceLastVisit / avgIntervalDays
//   >= 2.0 → riesgo alto  (muy atrasado)
//   >= 1.3 → riesgo medio
//   >= 1.0 → riesgo bajo  (ventana pasada)
router.get("/metrics/churn", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const limit = Math.min(parseInt(req.query.limit ?? "50") || 50, 200);

    // Traer todos los clientes con >= 2 citas completadas
    const users = await prisma.user.findMany({
      where: { ...(tenantId ? { tenantId } : {}) },
      select: {
        id: true,
        name: true,
        phone: true,
        appointments: {
          where: { status: "completed", ...(tenantId ? { tenantId } : {}) },
          select: { date: true, petName: true },
          orderBy: { date: "asc" },
        },
      },
    });

    const now = Date.now();
    const MS_DAY = 86400000;

    const atRisk = [];

    for (const u of users) {
      const appts = u.appointments;
      if (appts.length < 2) continue;

      // Calcular intervalo promedio entre citas consecutivas
      let totalInterval = 0;
      for (let i = 1; i < appts.length; i++) {
        totalInterval += new Date(appts[i].date) - new Date(appts[i - 1].date);
      }
      const avgIntervalMs = totalInterval / (appts.length - 1);
      const avgIntervalDays = Math.round(avgIntervalMs / MS_DAY);

      if (avgIntervalDays < 7) continue; // clientes diarios no son churn risk

      const lastAppt = appts[appts.length - 1];
      const daysSinceLast = Math.floor((now - new Date(lastAppt.date)) / MS_DAY);
      const overdueRatio = daysSinceLast / avgIntervalDays;

      if (overdueRatio < 1.0) continue; // aún dentro de su ventana normal

      const riskLevel = overdueRatio >= 2.0 ? "high" : overdueRatio >= 1.3 ? "medium" : "low";

      atRisk.push({
        id: u.id,
        name: u.name ?? "Sin nombre",
        phone: u.phone,
        petName: lastAppt.petName,
        lastVisitDays: daysSinceLast,
        avgIntervalDays,
        overdueRatio: Math.round(overdueRatio * 10) / 10,
        riskLevel,
        totalVisits: appts.length,
      });
    }

    // Ordenar por riesgo mayor primero
    atRisk.sort((a, b) => b.overdueRatio - a.overdueRatio);

    res.json(atRisk.slice(0, limit));
  } catch (error) {
    console.error("[Dashboard] Churn metrics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
