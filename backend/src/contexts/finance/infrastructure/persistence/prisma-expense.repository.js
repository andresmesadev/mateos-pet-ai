const prisma = require("../../../../lib/prisma");
const { ExpenseRepositoryPort } = require("../../application/ports/expense-repository.port");

class PrismaExpenseRepository extends ExpenseRepositoryPort {
  async findById(expenseId, ctx) {
    return (ctx?.tx ?? prisma).expense.findUnique({ where: { id: expenseId } });
  }

  async create(data, ctx) {
    return (ctx?.tx ?? prisma).expense.create({ data });
  }

  async void(expenseId, { voidedAt, voidReason }, ctx) {
    return (ctx?.tx ?? prisma).expense.update({
      where: { id: expenseId },
      data: { status: "voided", voidedAt, voidReason },
    });
  }

  async listByDateRange(tenantId, dateStart, dateEnd, ctx) {
    return (ctx?.tx ?? prisma).expense.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: "active",
        date: { gte: dateStart, lt: dateEnd },
      },
    });
  }
}

module.exports = { PrismaExpenseRepository };
