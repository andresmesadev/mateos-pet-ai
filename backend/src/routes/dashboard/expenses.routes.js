const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { getBogotaYmd, bogotaDayStart } = require("./shared");

const VALID_CATEGORIES = ["supplies", "utilities", "rent", "salary", "equipment", "marketing", "other"];
const VALID_PAYMENT_METHODS = ["cash", "transfer", "card", "other"];

function mapExpense(e) {
  return {
    id: e.id,
    tenantId: e.tenantId ?? null,
    date: e.date.toISOString(),
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    paymentMethod: e.paymentMethod,
    notes: e.notes ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

// POST /expenses
router.post("/expenses", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { category, description, amount, paymentMethod, notes, date } = req.body ?? {};

    if (!description?.trim()) return res.status(400).json({ error: "description es requerido" });
    if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "amount debe ser positivo" });
    if (category && !VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: "category inválido" });
    if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: "paymentMethod inválido" });

    const expense = await prisma.expense.create({
      data: {
        tenantId: tenantId ?? null,
        date: date ? new Date(date) : new Date(),
        category: category ?? "other",
        description: description.trim(),
        amount: Number(amount),
        paymentMethod: paymentMethod ?? "cash",
        notes: notes?.trim() || null,
      },
    });

    res.status(201).json(mapExpense(expense));
  } catch (error) {
    console.error("[Dashboard] Create expense error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/expenses", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const { from, to } = req.query;

    const dateFilter = {};
    if (from) dateFilter.gte = bogotaDayStart(from);
    if (to) dateFilter.lt = new Date(bogotaDayStart(to).getTime() + 86_400_000);

    const rows = await prisma.expense.findMany({
      where: {
        ...tenantFilter,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
      orderBy: { date: "desc" },
      take: 500,
    });

    res.json(rows.map(mapExpense));
  } catch (error) {
    console.error("[Dashboard] List expenses error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /metrics/cashbox?date=YYYY-MM-DD — arqueo del día
router.get("/metrics/cashbox", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    const date =
      typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : getBogotaYmd();

    const dayStart = bogotaDayStart(date);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const [transactions, expenses] = await Promise.all([
      prisma.transaction.findMany({
        where: { ...tenantFilter, paidAt: { gte: dayStart, lt: dayEnd } },
        include: {
          user: { select: { name: true, phone: true } },
          pet: { select: { name: true, type: true } },
          items: { orderBy: { id: "asc" } },
        },
        orderBy: { paidAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { ...tenantFilter, date: { gte: dayStart, lt: dayEnd } },
        orderBy: { date: "desc" },
      }),
    ]);

    const totalIncome = transactions.reduce((s, t) => s + Number(t.total), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const incomeByMethod = {};
    for (const tx of transactions) {
      const m = tx.paymentMethod;
      if (!incomeByMethod[m]) incomeByMethod[m] = { method: m, count: 0, total: 0 };
      incomeByMethod[m].count++;
      incomeByMethod[m].total += Number(tx.total);
    }

    const expensesByCategory = {};
    for (const e of expenses) {
      const c = e.category;
      if (!expensesByCategory[c]) expensesByCategory[c] = { category: c, count: 0, total: 0 };
      expensesByCategory[c].count++;
      expensesByCategory[c].total += Number(e.amount);
    }

    res.json({
      date,
      totalIncome: Math.round(totalIncome),
      totalExpenses: Math.round(totalExpenses),
      netBalance: Math.round(totalIncome - totalExpenses),
      transactionCount: transactions.length,
      expenseCount: expenses.length,
      incomeByMethod: Object.values(incomeByMethod),
      expensesByCategory: Object.values(expensesByCategory),
      transactions: transactions.map((t) => ({
        id: t.id,
        clientName: t.user?.name ?? null,
        petName: t.pet?.name ?? null,
        petType: t.pet?.type ?? null,
        total: Number(t.total),
        paymentMethod: t.paymentMethod,
        notes: t.notes ?? null,
        paidAt: t.paidAt.toISOString(),
        items: (t.items ?? []).map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        paymentMethod: e.paymentMethod,
        notes: e.notes ?? null,
        date: e.date.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[Dashboard] Cashbox metrics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
