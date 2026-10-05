const express = require("express");
const request = require("supertest");
jest.mock("../../lib/prisma", () => ({ tenant: { findUnique: jest.fn() }, $transaction: jest.fn(), transaction: { findMany: jest.fn() }, expense: { findMany: jest.fn() } }));
jest.mock("../../contexts/finance", () => ({ registerExpense: jest.fn(), voidExpense: jest.fn(), settleSystemCharge: jest.fn(), voidManualSale: jest.fn() }));
const prisma = require("../../lib/prisma");
const { allowVeterinaryDashboard } = require("../../middleware/allowVeterinaryDashboard");
const { getBogotaYmd } = require("../../routes/dashboard/shared");
const { readHistoryQuery, historySql } = require("../../routes/dashboard/financial-history-page");
const transactionRoutes = require("../../routes/dashboard/transactions.routes");
const expenseRoutes = require("../../routes/dashboard/expenses.routes");
const today = getBogotaYmd();
const range = `pagination=1&from=${today}&to=${today}`;
function app(role = "admin", tenantId = "tenant-a") {
  const result = express();
  result.use((req, _res, next) => { req.tenant = { tenantId }; req.actor = { type: role }; next(); });
  result.use(allowVeterinaryDashboard, transactionRoutes, expenseRoutes);
  return result;
}
const expense = { id: "expense-a", tenantId: "tenant-a", date: new Date(), createdAt: new Date(), amount: "12.34", category: "supplies", description: "Champú", paymentMethod: "cash", status: "active" };
const transaction = { ...expense, id: "sale-a", paidAt: new Date(), total: "12.34", origin: "manual_pos_sale", items: [] };
let tx;
beforeEach(() => {
  jest.resetAllMocks();
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["veterinary", "retail"] });
  tx = { $queryRaw: jest.fn(), transaction: { findMany: jest.fn().mockResolvedValue([transaction]) }, expense: { findMany: jest.fn().mockResolvedValue([expense]) } };
  tx.$queryRaw.mockResolvedValueOnce([{ total: 201, activeCount: 200, voidedCount: 1, activeTotal: "1000.29" }]).mockResolvedValueOnce([{ id: "sale-a" }]);
  prisma.$transaction.mockImplementation(callback => callback(tx));
});

test.each(["page=0", "page=2.5", "pageSize=51", "page=1&page=2", "status=unknown", "method=unknown", "origin=unknown", "pagination=2", "from=2026-02-30", "search=" + "a".repeat(201)])("parámetros inválidos se rechazan antes de consultar: %s", async parameter => {
  const response = await request(app()).get(`/transactions?${range}&${parameter}`);
  expect(response.status).toBe(400); expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("página final, conteo completo y suma decimal se leen en una única instantánea", async () => {
  const response = await request(app()).get(`/transactions?${range}&page=99`);
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ total: 201, page: 21, totalPages: 21, data: [{ id: "sale-a" }], summary: { activeCount: 200, voidedCount: 1, activeTotal: 1000.29 } });
  expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  expect(tx.transaction.findMany.mock.calls[0][0].where).toEqual({ tenantId: "tenant-a", id: { in: ["sale-a"] } });
  const pageQuery = tx.$queryRaw.mock.calls[1][0];
  expect(pageQuery.text).toContain('t."paidAt" DESC, t."id" DESC');
  expect(pageQuery.values.slice(-2)).toEqual([10, 200]);
});
test("una búsqueda parametrizada conserva tildes equivalentes y trata % y _ como texto", () => {
  const query = readHistoryQuery({ pagination: "1", from: today, to: today, search: "María 50%_'; DROP TABLE", method: "cash" }, "transactions");
  const sql = historySql("transactions", "tenant-a", query).where;
  expect(sql.text).toContain("normalize(lower"); expect(sql.text).toContain("AND NOT");
  expect(sql.text).not.toContain("DROP TABLE"); expect(sql.values).toContain("%maria%"); expect(sql.values).toContain("%50\\%\\_';%"); expect(sql.values).toContain("tenant-a");
});
test("recepción consulta hoy, pero no un rango histórico", async () => {
  const forbidden = await request(app("receptionist")).get(`/transactions?${range}&from=2020-01-01`);
  expect(forbidden.status).toBe(400); // repeated from is ambiguous, not an authorization bypass
  expect((await request(app("receptionist")).get(`/transactions?pagination=1&from=2020-01-01&to=${today}`)).status).toBe(403);
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect((await request(app("receptionist")).get(`/transactions?${range}&page=21`)).status).toBe(200);
});
test("gastos paginados mantienen permiso financiero y no aceptan un tenant del query", async () => {
  expect((await request(app("receptionist")).get(`/expenses?${range}`)).status).toBe(403);
  tx.$queryRaw.mockReset().mockResolvedValueOnce([{ total: 1, activeCount: 1, voidedCount: 0, activeTotal: "12.34" }]).mockResolvedValueOnce([{ id: "expense-a" }]);
  const response = await request(app()).get(`/expenses?${range}&tenantId=tenant-other&category=supplies`);
  expect(response.status).toBe(200); expect(response.body.summary.activeTotal).toBe(12.34);
  expect(tx.expense.findMany.mock.calls[0][0].where.tenantId).toBe("tenant-a");
  expect(tx.$queryRaw.mock.calls[0][0].values).not.toContain("tenant-other");
});
test("sin establecimiento no se abre una lectura global", async () => {
  expect((await request(app("admin", null)).get(`/transactions?${range}`)).status).toBe(400);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test("consumidores anteriores conservan los arreglos y sus límites", async () => {
  prisma.transaction.findMany.mockResolvedValue([transaction]); prisma.expense.findMany.mockResolvedValue([expense]);
  expect(Array.isArray((await request(app()).get(`/transactions?from=${today}&to=${today}`)).body)).toBe(true);
  expect(Array.isArray((await request(app()).get(`/expenses?from=${today}&to=${today}`)).body)).toBe(true);
  expect(prisma.transaction.findMany.mock.calls[0][0].take).toBe(200);
  expect(prisma.expense.findMany.mock.calls[0][0].take).toBe(500);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
