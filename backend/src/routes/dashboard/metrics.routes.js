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

// ── Métricas diarias del Inicio (5 cards, vs ayer) ────────────────────────────
// Citas de hoy · Clientes nuevos · Ingresos del día · Mascotas atendidas ·
// Recordatorios enviados. Cada una con su valor de ayer y el delta.
router.get("/metrics/daily", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    // Límites de día en hora Bogotá (UTC-5)
    const todayStart = bogotaDayStart(getBogotaYmd());
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

    const todayRange = { gte: todayStart, lt: tomorrowStart };
    const yesterdayRange = { gte: yesterdayStart, lt: todayStart };

    const [
      apptToday,
      apptYesterday,
      clientsToday,
      clientsYesterday,
      revenueToday,
      revenueYesterday,
      attendedToday,
      attendedYesterday,
      remindersActionsToday,
      remindersActionsYesterday,
      remindersUsersToday,
      remindersUsersYesterday,
    ] = await Promise.all([
      prisma.appointment.count({ where: { ...tenantFilter, date: todayRange } }),
      prisma.appointment.count({ where: { ...tenantFilter, date: yesterdayRange } }),
      prisma.user.count({ where: { ...tenantFilter, createdAt: todayRange } }),
      prisma.user.count({ where: { ...tenantFilter, createdAt: yesterdayRange } }),
      prisma.transaction.aggregate({ _sum: { total: true }, where: { ...tenantFilter, paidAt: todayRange } }),
      prisma.transaction.aggregate({ _sum: { total: true }, where: { ...tenantFilter, paidAt: yesterdayRange } }),
      prisma.appointment.findMany({
        where: { ...tenantFilter, status: "completed", date: todayRange },
        select: { petId: true },
        distinct: ["petId"],
      }),
      prisma.appointment.findMany({
        where: { ...tenantFilter, status: "completed", date: yesterdayRange },
        select: { petId: true },
        distinct: ["petId"],
      }),
      prisma.petNextAction.count({ where: { ...tenantFilter, reminderSentAt: todayRange } }),
      prisma.petNextAction.count({ where: { ...tenantFilter, reminderSentAt: yesterdayRange } }),
      prisma.user.count({ where: { ...tenantFilter, lastReminderSentAt: todayRange } }),
      prisma.user.count({ where: { ...tenantFilter, lastReminderSentAt: yesterdayRange } }),
    ]);

    const revToday = Number(revenueToday._sum.total ?? 0);
    const revYesterday = Number(revenueYesterday._sum.total ?? 0);
    const remToday = remindersActionsToday + remindersUsersToday;
    const remYesterday = remindersActionsYesterday + remindersUsersYesterday;

    const metric = (count, prev) => ({ count, prev, delta: count - prev });

    res.json({
      appointmentsToday: metric(apptToday, apptYesterday),
      newClientsToday: metric(clientsToday, clientsYesterday),
      revenueToday: metric(revToday, revYesterday),
      petsAttendedToday: metric(attendedToday.length, attendedYesterday.length),
      remindersSentToday: metric(remToday, remYesterday),
    });
  } catch (error) {
    console.error("[Dashboard] Daily metrics error:", error);
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

    // De esos, cuántos tienen al menos una cita posterior a SU lastReminderSentAt.
    // Antes era un N+1 (un findFirst por usuario). Ahora son 2 queries:
    // 1 para los contactados + 1 para todas sus citas válidas, y el cruce en JS.
    let reactivatedCount = 0;
    if (contactedUsers.length > 0) {
      // Recordatorio más antiguo → cota inferior para acotar la query de citas
      const earliestReminder = contactedUsers.reduce(
        (min, u) => (u.lastReminderSentAt < min ? u.lastReminderSentAt : min),
        contactedUsers[0].lastReminderSentAt
      );

      const appts = await prisma.appointment.findMany({
        where: {
          userId: { in: contactedUsers.map((u) => u.id) },
          date: { gt: earliestReminder },
          status: { notIn: ["cancelled", "no_show"] },
        },
        select: { userId: true, date: true },
      });

      const reminderByUser = new Map(
        contactedUsers.map((u) => [u.id, u.lastReminderSentAt])
      );
      const reactivatedSet = new Set();
      for (const a of appts) {
        const reminderDate = reminderByUser.get(a.userId);
        if (reminderDate && a.date > reminderDate) reactivatedSet.add(a.userId);
      }
      reactivatedCount = reactivatedSet.size;
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

    // Acotar el universo: solo clientes con al menos una cita completada en el
    // último año. Quien no viene hace +1 año ya abandonó (no es "riesgo"), y así
    // evitamos cargar toda la tabla de usuarios en memoria.
    const oneYearAgo = new Date(Date.now() - 365 * 86400000);
    const users = await prisma.user.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        appointments: {
          some: { status: "completed", date: { gte: oneYearAgo } },
        },
      },
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
