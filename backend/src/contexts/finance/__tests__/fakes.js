/**
 * Fakes en memoria de los puertos del contexto Finance, para tests de casos
 * de uso sin depender de Prisma ni de una base de datos real.
 */

function inRange(date, start, end) {
  const t = date.getTime();
  return t >= start.getTime() && t < end.getTime();
}

function createFakeExpenseRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async findById(id) {
      return rows.find((r) => r.id === id) || null;
    },
    async create(data) {
      const row = { id: `expense-${++seq}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    async void(id, { voidedAt, voidReason }) {
      const row = rows.find((r) => r.id === id);
      Object.assign(row, { status: "voided", voidedAt, voidReason });
      return row;
    },
    async listByDateRange(tenantId, dateStart, dateEnd) {
      return rows.filter(
        (r) => (!tenantId || r.tenantId === tenantId) && r.status === "active" && inRange(r.date, dateStart, dateEnd)
      );
    },
  };
}

function createFakeTransactionRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async createSystemCharge(data) {
      const exists = rows.find(
        (r) => r.appointmentId === data.appointmentId && r.origin === "system_appointment_completed"
      );
      if (exists) {
        const err = new Error("duplicate");
        err.code = "UNIQUE_TRANSACTION_VIOLATION";
        throw err;
      }
      const row = { id: `tx-${++seq}`, createdAt: new Date(), origin: "system_appointment_completed", ...data };
      rows.push(row);
      return row;
    },
    async listByDateRange(tenantId, dateStart, dateEnd) {
      return rows.filter((r) => (!tenantId || r.tenantId === tenantId) && inRange(r.paidAt, dateStart, dateEnd));
    },
  };
}

function createFakeDailyCloseRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async findByDate(tenantId, date) {
      return (
        rows.find((r) => (!tenantId || r.tenantId === tenantId) && r.date.getTime() === date.getTime()) || null
      );
    },
    async create(data) {
      const exists = rows.find((r) => r.tenantId === data.tenantId && r.date.getTime() === data.date.getTime());
      if (exists) {
        const err = new Error("duplicate");
        err.code = "UNIQUE_DAILY_CLOSE_VIOLATION";
        throw err;
      }
      const row = { id: `close-${++seq}`, createdAt: new Date(), financialPeriodId: null, ...data };
      rows.push(row);
      return row;
    },
    async listByDateRange(tenantId, dateStart, dateEnd) {
      return rows
        .filter((r) => (!tenantId || r.tenantId === tenantId) && r.date.getTime() >= dateStart.getTime() && r.date.getTime() <= dateEnd.getTime())
        .sort((a, b) => a.date - b.date);
    },
    async assignToPeriod(dailyCloseIds, financialPeriodId) {
      let count = 0;
      for (const row of rows) {
        if (dailyCloseIds.includes(row.id) && row.financialPeriodId === null) {
          row.financialPeriodId = financialPeriodId;
          count++;
        }
      }
      return count;
    },
  };
}

function createFakeFinancialPeriodRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async findByRange(tenantId, periodStart, periodEnd) {
      return (
        rows.find(
          (r) =>
            (!tenantId || r.tenantId === tenantId) &&
            r.periodStart.getTime() === periodStart.getTime() &&
            r.periodEnd.getTime() === periodEnd.getTime()
        ) || null
      );
    },
    async create(data) {
      const exists = rows.find(
        (r) =>
          r.tenantId === data.tenantId &&
          r.periodStart.getTime() === data.periodStart.getTime() &&
          r.periodEnd.getTime() === data.periodEnd.getTime()
      );
      if (exists) {
        const err = new Error("duplicate");
        err.code = "UNIQUE_FINANCIAL_PERIOD_VIOLATION";
        throw err;
      }
      const row = { id: `period-${++seq}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
  };
}

function createFakeCommissionReader(initial = []) {
  return {
    async listByDateRange(tenantId, dateStart, dateEnd) {
      return initial.filter((r) => (!tenantId || r.tenantId === tenantId) && inRange(r.completedAt, dateStart, dateEnd));
    },
  };
}

function createFakeEventPublisher() {
  const events = [];
  return {
    events,
    async publish(eventName, payload) {
      events.push({ eventName, payload });
    },
  };
}

module.exports = {
  createFakeExpenseRepository,
  createFakeTransactionRepository,
  createFakeDailyCloseRepository,
  createFakeFinancialPeriodRepository,
  createFakeCommissionReader,
  createFakeEventPublisher,
};
