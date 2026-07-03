const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { getBogotaYmd } = require("./shared");
const { getDailyClose, generateDailyClose } = require("../../contexts/finance");
const {
  DailyCloseNotFoundError,
  DuplicateDailyCloseError,
  IncompleteDailyCloseError,
  MissingTenantError,
} = require("../../contexts/finance/domain/errors");
const { civilDayBounds } = require("../../contexts/shared/business-day");

// GET /daily-close?date=YYYY-MM-DD
// Entregable Puente: cada sección de la respuesta proviene de UN solo universo
// de datos (cierre del residuo del hallazgo A1 / ADR 007-D1):
//  - `appointments`: citas del día civil (ADR 008).
//  - `commissions`: SIEMPRE el universo Commission (su significado histórico) —
//    del snapshot oficial si el día está cerrado, o de lectura en vivo si no.
//  - `income` (aditiva): el ingreso oficial (Transaction) cuando existe cierre.
router.get("/daily-close", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    const date =
      typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : getBogotaYmd();

    const { start: dayStart, end: dayEnd } = civilDayBounds(date);

    // ── 1. Appointment summary del día civil ────────────────────────────────
    const appointments = await prisma.appointment.findMany({
      where: { ...tenantFilter, date: { gte: dayStart, lt: dayEnd } },
      select: {
        id: true, status: true, staffId: true, petId: true,
        petName: true, serviceType: true,
        service: { select: { category: { select: { name: true } } } },
        commissions: {
          where: { status: "active" },
          select: {
            id: true, resolvedPrice: true, priceSource: true,
            staffShare: true, businessShare: true, splitRate: true,
            staffId: true, staff: { select: { name: true } },
          },
        },
      },
    });

    const total      = appointments.length;
    const completed  = appointments.filter((a) => a.status === "completed").length;
    const cancelled  = appointments.filter((a) => a.status === "cancelled").length;
    const noShow     = appointments.filter((a) => a.status === "no_show").length;
    const pending    = appointments.filter(
      (a) => !["completed", "cancelled", "no_show"].includes(a.status)
    ).length;

    // ── 2. Commission summary — snapshot oficial si existe, lectura en vivo si no ─
    let commissionsSection;
    let missingCommissionsCount;
    let incomeSection = null;

    try {
      const { dailyClose } = await getDailyClose({ tenantId: tenantId ?? null, date });

      const staffIds = dailyClose.staffBreakdown.map((b) => b.staffId).filter(Boolean);
      const staffRows = staffIds.length
        ? await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
        : [];
      const nameById = new Map(staffRows.map((s) => [s.id, s.name]));

      const byStaff = dailyClose.staffBreakdown.map((entry) => ({
        staffId: entry.staffId ?? null,
        staffName: entry.staffId ? (nameById.get(entry.staffId) ?? "Sin asignar") : "Sin asignar",
        count: entry.count,
        revenue: Number(entry.staffShare) + Number(entry.businessShare),
        staffShare: Number(entry.staffShare),
        businessShare: Number(entry.businessShare),
      }));

      commissionsSection = {
        count: byStaff.reduce((s, b) => s + b.count, 0),
        // Universo Commission — el significado que este campo siempre tuvo.
        totalRevenue: byStaff.reduce((s, b) => s + b.revenue, 0),
        totalStaffShare: byStaff.reduce((s, b) => s + b.staffShare, 0),
        totalBusinessShare: byStaff.reduce((s, b) => s + b.businessShare, 0),
        byStaff,
      };

      // Universo Transaction — el ingreso oficial del negocio (ADR 007-D1).
      incomeSection = {
        incomeTotal: Number(dailyClose.incomeTotal),
        expenseTotal: Number(dailyClose.expenseTotal),
        netAmount: Number(dailyClose.netAmount),
        closed: true,
      };

      // El cierre ya es un hecho oficial e inmutable: por definición no puede
      // haber comisiones faltantes que aún no se hayan consolidado.
      missingCommissionsCount = 0;
    } catch (err) {
      if (!(err instanceof DailyCloseNotFoundError)) throw err;

      // Sin Cierre del Día oficial todavía: mismo cálculo en vivo de siempre,
      // leyendo Commission activas — nunca recalculando sus reglas de negocio.
      const commissions = await prisma.commission.findMany({
        where: { ...tenantFilter, status: "active", completedAt: { gte: dayStart, lt: dayEnd } },
        include: { staff: { select: { id: true, name: true } } },
      });

      const totalRevenue       = commissions.reduce((s, c) => s + Number(c.resolvedPrice), 0);
      const totalStaffShare    = commissions.reduce((s, c) => s + Number(c.staffShare), 0);
      const totalBusinessShare = commissions.reduce((s, c) => s + Number(c.businessShare), 0);

      const staffMap = new Map();
      for (const c of commissions) {
        const key = c.staffId ?? "__unassigned__";
        const name = c.staff?.name ?? "Sin asignar";
        if (!staffMap.has(key)) {
          staffMap.set(key, { staffId: c.staffId ?? null, staffName: name, count: 0, revenue: 0, staffShare: 0, businessShare: 0 });
        }
        const entry = staffMap.get(key);
        entry.count += 1;
        entry.revenue += Number(c.resolvedPrice);
        entry.staffShare += Number(c.staffShare);
        entry.businessShare += Number(c.businessShare);
      }

      commissionsSection = {
        count: commissions.length,
        totalRevenue,
        totalStaffShare,
        totalBusinessShare,
        byStaff: [...staffMap.values()],
      };

      const completedGroomingIds = new Set(
        appointments
          .filter((a) => {
            const isCompleted = a.status === "completed";
            const cat = a.service?.category?.name ?? "";
            const stype = (a.serviceType ?? "").toLowerCase();
            const isGrooming = cat === "grooming" ||
              ["grooming","bath","baño","peluquer","corte","spa","deslanado","colorimetría","colorimetria","antipulgas"]
                .some((p) => stype.includes(p));
            return isCompleted && isGrooming;
          })
          .map((a) => a.id)
      );
      const commissionsApptIds = new Set(commissions.map((c) => c.appointmentId));
      missingCommissionsCount = [...completedGroomingIds].filter((id) => !commissionsApptIds.has(id)).length;
    }

    res.json({
      date,
      appointments: { total, completed, cancelled, noShow, pending },
      commissions: commissionsSection,
      missingCommissionsCount,
      income: incomeSection,
    });
  } catch (error) {
    console.error("[DailyClose] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /daily-close — Entregable Puente, caso de uso 4: Generar Cierre del Día
// (acción explícita del operador). Rechaza días incompletos (ADR 007-D2).
router.post("/daily-close", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const date =
      typeof req.body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
        ? req.body.date
        : getBogotaYmd();

    const { dailyClose } = await generateDailyClose({ tenantId, date });

    res.status(201).json({
      id: dailyClose.id,
      date,
      incomeTotal: Number(dailyClose.incomeTotal),
      expenseTotal: Number(dailyClose.expenseTotal),
      netAmount: Number(dailyClose.netAmount),
      staffBreakdown: dailyClose.staffBreakdown,
      createdAt: dailyClose.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof MissingTenantError) return res.status(400).json({ error: error.message });
    if (error instanceof DuplicateDailyCloseError) return res.status(409).json({ error: error.message });
    if (error instanceof IncompleteDailyCloseError) {
      return res.status(422).json({ error: error.message, missingAppointmentIds: error.missingAppointmentIds });
    }
    console.error("[DailyClose] Generate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
