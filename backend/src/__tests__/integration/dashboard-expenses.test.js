const express = require("express");
const request = require("supertest");
jest.mock("../../lib/prisma", () => ({ tenant: { findUnique: jest.fn() }, expense: { findFirst: jest.fn() } }));
jest.mock("../../contexts/finance", () => ({ registerExpense: jest.fn(), voidExpense: jest.fn() }));
const prisma = require("../../lib/prisma");
const finance = require("../../contexts/finance");
const { allowVeterinaryDashboard } = require("../../middleware/allowVeterinaryDashboard");
const routes = require("../../routes/dashboard/expenses.routes");
function app(role = "admin", tenantId = "tenant-a") {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { tenantId }; req.actor = { type: role, email: "test@example.invalid" }; next(); });
  app.use(allowVeterinaryDashboard, routes); return app;
}
const expense = { id: "expense-a", tenantId: "tenant-a", category: "supplies", description: "Champú", amount: 12500.29, paymentMethod: "cash", responsible: "Ana", status: "voided", notes: "Factura", date: new Date(), createdAt: new Date(), voidedAt: new Date(), voidReason: "Duplicado" };
beforeEach(() => { jest.resetAllMocks(); prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["veterinary", "retail"] }); });

test("la lectura individual aplica tenant y conserva datos de anulación", async () => {
  prisma.expense.findFirst.mockResolvedValue(expense);
  const response = await request(app()).get("/expenses/expense-a");
  expect(response.status).toBe(200);
  expect(prisma.expense.findFirst).toHaveBeenCalledWith({ where: { id: "expense-a", tenantId: "tenant-a" } });
  expect(response.body).toMatchObject({ amount: 12500.29, responsible: "Ana", status: "voided", voidReason: "Duplicado" });
});
test("un egreso de otro tenant no se expone", async () => {
  prisma.expense.findFirst.mockResolvedValue(null);
  expect((await request(app()).get("/expenses/expense-other")).status).toBe(404);
  expect(prisma.expense.findFirst.mock.calls[0][0].where.tenantId).toBe("tenant-a");
});
test.each(["receptionist", "vet", "groomer"])("%s no puede consultar ni anular egresos", async role => {
  expect((await request(app(role)).get("/expenses/expense-a")).status).toBe(403);
  expect((await request(app(role)).post("/expenses/expense-a/void").send({ reason: "Duplicado" })).status).toBe(403);
  expect(prisma.expense.findFirst).not.toHaveBeenCalled(); expect(finance.voidExpense).not.toHaveBeenCalled();
});
test("la ruta valida texto antes de invocar el dominio", async () => {
  for (const body of [{ description: {} }, { description: "Gasto", notes: {} }]) expect((await request(app()).post("/expenses").send(body)).status).toBe(400);
  expect((await request(app()).post("/expenses/expense-a/void").send({ reason: {} })).status).toBe(400);
  expect(finance.registerExpense).not.toHaveBeenCalled(); expect(finance.voidExpense).not.toHaveBeenCalled();
});
