const express = require("express");
const router = express.Router();
// Entregable Puente — Finanzas: Períodos Financieros e Historial (casos 5, 7, 8).
const { generateFinancialPeriod, getFinancialPeriod, getFinancialHistory } = require("../../contexts/finance");
const {
  IncompleteFinancialPeriodError,
  DuplicateFinancialPeriodError,
  FinancialPeriodNotFoundError,
  MissingTenantError,
} = require("../../contexts/finance/domain/errors");

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Fix post-auditoría de seguridad (2026-09-07, hallazgo F2): el regex YMD
// solo validaba el formato, no el tamaño del rango — un rango de miles/
// millones de días desataba un fan-out de queries por día (enumerateDates)
// que podía tumbar el backend (única instancia en el VPS). MAX_RANGE_DAYS
// es generoso (más de un año) para no romper ningún uso legítimo del
// dashboard, que siempre opera sobre rangos de días/semanas/meses.
const MAX_RANGE_DAYS = 400;

function isRangeTooWide(start, end) {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return true;
  const spanDays = (endMs - startMs) / (24 * 60 * 60 * 1000);
  return spanDays < 0 || spanDays > MAX_RANGE_DAYS;
}

function mapPeriod(p) {
  return {
    id: p.id,
    periodStart: p.periodStart.toISOString().slice(0, 10),
    periodEnd: p.periodEnd.toISOString().slice(0, 10),
    incomeTotal: Number(p.incomeTotal),
    expenseTotal: Number(p.expenseTotal),
    netAmount: Number(p.netAmount),
    breakdown: p.breakdown,
    createdAt: p.createdAt.toISOString(),
  };
}

// POST /financial-periods — Generar Período Financiero (partición del tiempo).
router.post("/financial-periods", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { periodStart, periodEnd } = req.body ?? {};
    if (!YMD.test(periodStart ?? "") || !YMD.test(periodEnd ?? "")) {
      return res.status(400).json({ error: "periodStart y periodEnd (YYYY-MM-DD) son requeridos" });
    }
    if (isRangeTooWide(periodStart, periodEnd)) {
      return res.status(400).json({ error: `El rango no puede superar ${MAX_RANGE_DAYS} días` });
    }

    const { financialPeriod } = await generateFinancialPeriod({ tenantId, periodStart, periodEnd });
    res.status(201).json(mapPeriod(financialPeriod));
  } catch (error) {
    if (error instanceof MissingTenantError) return res.status(400).json({ error: error.message });
    if (error instanceof DuplicateFinancialPeriodError) return res.status(409).json({ error: error.message });
    if (error instanceof IncompleteFinancialPeriodError) return res.status(422).json({ error: error.message });
    console.error("[FinancialPeriods] Generate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /financial-periods?periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD
router.get("/financial-periods", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { periodStart, periodEnd } = req.query;
    if (!YMD.test(periodStart ?? "") || !YMD.test(periodEnd ?? "")) {
      return res.status(400).json({ error: "periodStart y periodEnd (YYYY-MM-DD) son requeridos" });
    }
    if (isRangeTooWide(periodStart, periodEnd)) {
      return res.status(400).json({ error: `El rango no puede superar ${MAX_RANGE_DAYS} días` });
    }

    const { financialPeriod } = await getFinancialPeriod({ tenantId: tenantId ?? null, periodStart, periodEnd });
    res.json(mapPeriod(financialPeriod));
  } catch (error) {
    if (error instanceof FinancialPeriodNotFoundError) return res.status(404).json({ error: error.message });
    console.error("[FinancialPeriods] Get error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /financial-history?from=YYYY-MM-DD&to=YYYY-MM-DD — días cerrados (hecho
// oficial) + días sin cerrar (vista preliminar con las MISMAS reglas de dominio).
router.get("/financial-history", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { from, to } = req.query;
    if (!YMD.test(from ?? "") || !YMD.test(to ?? "")) {
      return res.status(400).json({ error: "from y to (YYYY-MM-DD) son requeridos" });
    }
    if (isRangeTooWide(from, to)) {
      return res.status(400).json({ error: `El rango no puede superar ${MAX_RANGE_DAYS} días` });
    }

    const { days } = await getFinancialHistory({ tenantId: tenantId ?? null, rangeStart: from, rangeEnd: to });

    res.json({
      from,
      to,
      days: days.map((d) =>
        d.closed
          ? {
              date: d.date,
              closed: true,
              incomeTotal: Number(d.dailyClose.incomeTotal),
              expenseTotal: Number(d.dailyClose.expenseTotal),
              netAmount: Number(d.dailyClose.netAmount),
              staffBreakdown: d.dailyClose.staffBreakdown,
            }
          : {
              date: d.date,
              closed: false,
              incomeTotal: d.preview.incomeTotal,
              expenseTotal: d.preview.expenseTotal,
              netAmount: d.preview.netAmount,
              staffBreakdown: d.preview.staffBreakdown,
            }
      ),
    });
  } catch (error) {
    console.error("[FinancialHistory] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
