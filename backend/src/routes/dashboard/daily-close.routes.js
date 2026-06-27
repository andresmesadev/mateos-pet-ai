const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { getBogotaYmd, bogotaDayStart } = require("./shared");

// GET /daily-close?date=YYYY-MM-DD
// Returns the day's financial summary by reading Commission records (never recalculates).
// Commission is the single source of truth for all financial calculations.
router.get("/daily-close", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    const date =
      typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : getBogotaYmd();

    const dayStart = bogotaDayStart(date);
    const dayEnd   = new Date(dayStart.getTime() + 86_400_000);

    // ── 1. Appointment summary for the day ───────────────────────────────────
    const appointments = await prisma.appointment.findMany({
      where: { ...tenantFilter, date: { gte: dayStart, lt: dayEnd } },
      select: {
        id: true, status: true, staffId: true, petId: true,
        petName: true, serviceType: true,
        service: { select: { category: true } },
        commission: {
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

    // ── 2. Commission summary — read only, no recalculation ─────────────────
    const commissions = await prisma.commission.findMany({
      where: {
        ...tenantFilter,
        completedAt: { gte: dayStart, lt: dayEnd },
      },
      include: {
        staff: { select: { id: true, name: true } },
      },
    });

    const totalRevenue      = commissions.reduce((s, c) => s + Number(c.resolvedPrice), 0);
    const totalStaffShare   = commissions.reduce((s, c) => s + Number(c.staffShare), 0);
    const totalBusinessShare = commissions.reduce((s, c) => s + Number(c.businessShare), 0);

    // Per-staff breakdown
    const staffMap = new Map();
    for (const c of commissions) {
      const key = c.staffId ?? "__unassigned__";
      const name = c.staff?.name ?? "Sin asignar";
      if (!staffMap.has(key)) {
        staffMap.set(key, {
          staffId: c.staffId ?? null,
          staffName: name,
          count: 0,
          revenue: 0,
          staffShare: 0,
          businessShare: 0,
        });
      }
      const entry = staffMap.get(key);
      entry.count        += 1;
      entry.revenue      += Number(c.resolvedPrice);
      entry.staffShare   += Number(c.staffShare);
      entry.businessShare += Number(c.businessShare);
    }

    // Completed grooming appointments without a recorded commission
    const completedGroomingIds = new Set(
      appointments
        .filter((a) => {
          const isCompleted = a.status === "completed";
          const cat = a.service?.category ?? "";
          const stype = (a.serviceType ?? "").toLowerCase();
          const isGrooming = cat === "grooming" ||
            ["grooming","bath","baño","peluquer","corte","spa","deslanado","colorimetría","colorimetria","antipulgas"]
              .some((p) => stype.includes(p));
          return isCompleted && isGrooming;
        })
        .map((a) => a.id)
    );
    const commissionsApptIds = new Set(commissions.map((c) => c.appointmentId));
    const missingCommissions = [...completedGroomingIds].filter(
      (id) => !commissionsApptIds.has(id)
    );

    res.json({
      date,
      appointments: { total, completed, cancelled, noShow, pending },
      commissions: {
        count: commissions.length,
        totalRevenue,
        totalStaffShare,
        totalBusinessShare,
        byStaff: [...staffMap.values()],
      },
      missingCommissionsCount: missingCommissions.length,
    });
  } catch (error) {
    console.error("[DailyClose] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
