const prisma = require("../../../../lib/prisma");
const { ExpenseRepositoryPort } = require("../../application/ports/expense-repository.port");

class PrismaExpenseRepository extends ExpenseRepositoryPort {
  async findById(expenseId) {
    return prisma.expense.findUnique({ where: { id: expenseId } });
  }

  async create(data) {
    return prisma.expense.create({ data });
  }

  async void(expenseId, { voidedAt, voidReason }) {
    return prisma.expense.update({
      where: { id: expenseId },
      data: { status: "voided", voidedAt, voidReason },
    });
  }

  async listByDateRange(tenantId, dateStart, dateEnd) {
    return prisma.expense.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: "active",
        date: { gte: dateStart, lt: dateEnd },
      },
    });
  }
}

module.exports = { PrismaExpenseRepository };
