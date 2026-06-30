/**
 * Fakes en memoria de los puertos del contexto Staff, para tests de casos
 * de uso sin depender de Prisma ni de una base de datos real.
 */

function createFakeStaffRepository(initial = []) {
  const staff = [...initial];
  let seq = 0;
  return {
    staff,
    async findById(id) {
      return staff.find((s) => s.id === id) || null;
    },
    async create(data) {
      const member = { id: `staff-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...data };
      staff.push(member);
      return member;
    },
    async update(id, data) {
      const member = staff.find((s) => s.id === id);
      Object.assign(member, data, { updatedAt: new Date() });
      return member;
    },
    async listActive({ tenantId, role, includeInactive }) {
      return staff.filter(
        (s) => s.tenantId === tenantId && (!role || s.role === role) && (includeInactive || s.active)
      );
    },
  };
}

function createFakeAvailabilityRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async listByStaff(staffId) {
      return rows.filter((r) => r.staffId === staffId);
    },
    async listBaseScheduleByStaff(staffId) {
      return rows.filter((r) => r.staffId === staffId && r.type === "base_schedule");
    },
    async create(data) {
      const row = { id: `avail-${++seq}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
  };
}

function createFakeStaffCapabilityRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async listActiveByStaff(staffId) {
      return rows.filter((r) => r.staffId === staffId && r.active);
    },
    async listActiveByService(serviceId) {
      return rows.filter((r) => r.serviceId === serviceId && r.active);
    },
    async create(data) {
      const exists = rows.find((r) => r.staffId === data.staffId && r.serviceId === data.serviceId && r.active);
      if (exists) {
        const err = new Error("duplicate");
        err.code = "UNIQUE_STAFF_CAPABILITY_VIOLATION";
        throw err;
      }
      const row = { id: `cap-${++seq}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    async revoke(staffId, serviceId) {
      rows.filter((r) => r.staffId === staffId && r.serviceId === serviceId && r.active).forEach((r) => (r.active = false));
    },
  };
}

function createFakeCommissionRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async create(data) {
      const row = { id: `commission-${++seq}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    async listByStaffAndPeriod(staffId, periodStart, periodEnd) {
      const start = new Date(periodStart).getTime();
      const end = new Date(periodEnd).getTime();
      return rows.filter((r) => r.staffId === staffId && r.completedAt.getTime() >= start && r.completedAt.getTime() < end);
    },
  };
}

function createFakeSettlementRepository(initial = []) {
  const rows = [...initial];
  let seq = 0;
  return {
    rows,
    async findActiveByStaffAndPeriod(staffId, periodStart, periodEnd) {
      return (
        rows.find(
          (r) =>
            r.staffId === staffId &&
            r.status === "active" &&
            r.periodStart.getTime() === new Date(periodStart).getTime() &&
            r.periodEnd.getTime() === new Date(periodEnd).getTime()
        ) || null
      );
    },
    async create(data) {
      const exists = rows.find(
        (r) =>
          r.staffId === data.staffId &&
          r.status === "active" &&
          r.periodStart.getTime() === data.periodStart.getTime() &&
          r.periodEnd.getTime() === data.periodEnd.getTime()
      );
      if (exists) {
        const err = new Error("duplicate");
        err.code = "UNIQUE_SETTLEMENT_VIOLATION";
        throw err;
      }
      const row = { id: `settlement-${++seq}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    async list({ tenantId, staffId }) {
      return rows.filter((r) => (!tenantId || r.tenantId === tenantId) && (!staffId || r.staffId === staffId));
    },
  };
}

function createFakeServiceExistenceReader(existingServiceIds = []) {
  return {
    async exists(serviceId) {
      return existingServiceIds.includes(serviceId);
    },
  };
}

function createFakeServiceCategoryReader(categoriesByService = {}) {
  return {
    async getCategoryForService(serviceId) {
      return categoriesByService[serviceId] || null;
    },
  };
}

function createFakeBusinessConfigReader({ activeModules = ["grooming", "veterinary"], splitRate = 0.5 } = {}) {
  return {
    async getActiveModules() {
      return activeModules;
    },
    async getCommissionSplitRate() {
      return splitRate;
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
  createFakeStaffRepository,
  createFakeAvailabilityRepository,
  createFakeStaffCapabilityRepository,
  createFakeCommissionRepository,
  createFakeSettlementRepository,
  createFakeServiceExistenceReader,
  createFakeServiceCategoryReader,
  createFakeBusinessConfigReader,
  createFakeEventPublisher,
};
