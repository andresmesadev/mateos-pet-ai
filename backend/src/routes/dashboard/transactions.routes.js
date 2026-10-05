const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { HistoryQueryError, readHistoryQuery, readFinancialHistoryPage } = require("./financial-history-page");
const { getBogotaYmd, bogotaDayStart, mapTransaction } = require("./shared");
const { guardManualSaleLink, settleSystemCharge, voidManualSale } = require("../../contexts/finance");
const {
  TransactionNotFoundError,
  TransactionAlreadyVoidedError,
  InvalidTransactionOperationError,
  DailyCloseAlreadyExistsForDateError,
} = require("../../contexts/finance/domain/errors");

function mapTransactionDomainError(res, error) {
  if (error instanceof InvalidTransactionOperationError) return res.status(422).json({ error: error.message });
  if (error instanceof TransactionNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof TransactionAlreadyVoidedError || error instanceof DailyCloseAlreadyExistsForDateError) {
    return res.status(409).json({ error: error.message });
  }
  return null;
}

// ── POS / Facturación (TAREA 17) ──────────────────────────────────────────────

const VALID_PAYMENT_METHODS = ["cash", "transfer", "card", "other"];

const TRANSACTION_INCLUDE = {
  user: { select: { id: true, name: true, phone: true } },
  pet:  { select: { id: true, name: true, type: true } },
  appointment: { select: { id: true, serviceType: true, date: true } },
  items: { orderBy: { id: "asc" }, include: { inventoryReturn: true } },
};

function operationalDayFilter(req) {
  if (!req.access || req.access.capabilities.administration) return {};
  const start = bogotaDayStart(getBogotaYmd());
  return { paidAt: { gte: start, lt: new Date(start.getTime() + 86_400_000) } };
}

// POST /transactions — el workflow confirma cobro e inventario en una transacción.
router.post("/transactions", async (req, res) => {
  try {
    const { confirmPosSale } = require("../../contexts");
    const response = await confirmPosSale({ tenantId: req.tenant.tenantId, actor: req.actor,
      operationKey: req.get("Idempotency-Key"), command: req.body ?? {} });
    res.status(response.replayed ? 200 : 201).json({ ...mapTransaction(response.transaction), operationId: response.operationId ?? null, replayed: response.replayed ?? false });
  } catch (error) {
    if (error.status && error.code) return res.status(error.status).json({ error: error.message, code: error.code });
    if (mapTransactionDomainError(res, error)) return;
    console.error("[Dashboard] Confirm sale error:", error.message);
    res.status(503).json({ error: "No se pudo comprobar el resultado del cobro. Consulta la operación antes de repetirla.", code: "RESULT_UNCERTAIN" });
  }
});

// POST /transactions/:id/settle — ADR 007-D3(a): liquidar el cobro de sistema
// (método de pago / notas) — nunca su monto.
router.post("/transactions/:id/settle", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { paymentMethod, notes } = req.body ?? {};
    if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: `paymentMethod inválido. Valores: ${VALID_PAYMENT_METHODS.join(", ")}` });
    }

    const target = await prisma.transaction.findFirst({
      where: { id: req.params.id, ...(tenantId ? { tenantId } : {}), ...operationalDayFilter(req) },
      select: { appointmentId: true, origin: true },
    });
    if (!target) return res.status(404).json({ error: "Not found" });
    if (target.origin !== "system_appointment_completed" || !target.appointmentId) {
      return res.status(422).json({ error: "Solo los cobros de sistema se liquidan por este comando (ADR 007)." });
    }

    const { transaction } = await settleSystemCharge({
      tenantId,
      appointmentId: target.appointmentId,
      paymentMethod,
      notes,
      recordedBy: { id: req.actor?.staffId ? `staff:${req.actor.staffId}` : req.actor?.email ? `admin:${req.actor.email}` : null, name: req.actor?.name ?? null, role: req.actor?.type ?? null },
    });

    const full = await prisma.transaction.findUnique({ where: { id: transaction.id }, include: TRANSACTION_INCLUDE });
    res.json(mapTransaction(full));
  } catch (error) {
    if (mapTransactionDomainError(res, error)) return;
    console.error("[Dashboard] Settle transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /transactions/:id/void — anulación de venta manual (patrón completo, Etapa 4).
router.post("/transactions/:id/void", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { reason } = req.body ?? {};

    const { transaction } = await voidManualSale({ tenantId, transactionId: req.params.id, reason });

    const full = await prisma.transaction.findUnique({ where: { id: transaction.id }, include: TRANSACTION_INCLUDE });
    res.json(mapTransaction(full));
  } catch (error) {
    if (mapTransactionDomainError(res, error)) return;
    console.error("[Dashboard] Void transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /transactions — list (date range optional: ?from=YYYY-MM-DD&to=YYYY-MM-DD)
router.get("/transactions", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const { from, to } = req.query;
    if (req.query.pagination !== undefined) {
      const query = readHistoryQuery(req.query, "transactions");
      if (req.access && !req.access.capabilities.administration && (query.from !== getBogotaYmd() || query.to !== getBogotaYmd())) {
        return res.status(403).json({ error: "Solo puedes consultar cobros de hoy." });
      }
      return res.json(await readFinancialHistoryPage(prisma, "transactions", tenantId, query, TRANSACTION_INCLUDE, mapTransaction));
    }
    if (req.access && !req.access.capabilities.administration && ((from && from !== getBogotaYmd()) || (to && to !== getBogotaYmd()))) return res.status(403).json({ error: "Tu acceso permite consultar la caja de hoy." });

    const dateFilter = {};
    if (from) dateFilter.gte = bogotaDayStart(from);
    if (to) dateFilter.lt = new Date(bogotaDayStart(to).getTime() + 86_400_000);
    if (req.access && !req.access.capabilities.administration) {
      dateFilter.gte = bogotaDayStart(getBogotaYmd());
      dateFilter.lt = new Date(dateFilter.gte.getTime() + 86_400_000);
    }

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
    if (error instanceof HistoryQueryError) return res.status(400).json({ error: error.message });
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
      where: { id, ...tenantFilter, ...operationalDayFilter(req) },
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
        // Solo ingreso activo cuenta — misma regla que el Cierre oficial (Etapa 4 del Puente).
        where: { ...tenantFilter, status: "active", paidAt: { gte: periodStart, lt: periodEnd } },
        include: { items: true },
      }),
      prisma.transaction.findMany({
        where: { ...tenantFilter, status: "active", paidAt: { gte: prevStart, lt: periodStart } },
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
