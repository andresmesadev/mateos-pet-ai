/**
 * Fakes en memoria de los puertos del contexto Servicios, para tests de
 * casos de uso sin depender de Prisma ni de una base de datos real.
 */

function createFakeServiceRepository(initial = []) {
  const services = [...initial];
  let seq = 0;
  return {
    services,
    async findById(id) {
      return services.find((s) => s.id === id) || null;
    },
    async findActiveByNameAndCategory(tenantId, categoryId, name) {
      return (
        services.find(
          (s) => s.tenantId === tenantId && s.categoryId === categoryId && s.name === name && s.active
        ) || null
      );
    },
    async create(data) {
      const service = { id: `service-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...data };
      services.push(service);
      return service;
    },
    async update(id, data) {
      const service = services.find((s) => s.id === id);
      Object.assign(service, data, { updatedAt: new Date() });
      return service;
    },
    async listAvailable({ tenantId, categoryId, includeInactive }) {
      return services.filter(
        (s) =>
          s.tenantId === tenantId &&
          (!categoryId || s.categoryId === categoryId) &&
          (includeInactive || s.active)
      );
    },
  };
}

function createFakePriceRuleRepository(initial = []) {
  const rules = [...initial];
  let seq = 0;
  return {
    rules,
    async listByService(serviceId) {
      return rules.filter((r) => r.serviceId === serviceId);
    },
    async findActiveByTarget(serviceId, targetType, targetId) {
      return (
        rules.find(
          (r) => r.serviceId === serviceId && r.targetType === targetType && r.targetId === targetId && r.active
        ) || null
      );
    },
    async create(data) {
      const exists = rules.find(
        (r) => r.serviceId === data.serviceId && r.targetType === data.targetType && r.targetId === data.targetId && r.active
      );
      if (exists) {
        const err = new Error("duplicate");
        err.code = "UNIQUE_PRICE_RULE_VIOLATION";
        throw err;
      }
      const rule = { id: `rule-${++seq}`, createdAt: new Date(), ...data };
      rules.push(rule);
      return rule;
    },
    async updatePrice(id, newPrice) {
      const rule = rules.find((r) => r.id === id);
      rule.price = newPrice;
      return rule;
    },
  };
}

function createFakeServiceCategoryReader(categories = []) {
  return {
    async findById(categoryId) {
      return categories.find((c) => c.id === categoryId) || null;
    },
  };
}

function createFakeBusinessConfigReader(activeModules = ["grooming", "veterinary"]) {
  return { async getActiveModules() { return activeModules; } };
}

function createFakeTargetExistenceReader({ clients = [], pets = [] } = {}) {
  return {
    async clientExists(clientId, tenantId = null) {
      return clients.some(
        (c) => (typeof c === "string" ? c === clientId : c.id === clientId) &&
          (!tenantId || (typeof c === "object" && c.tenantId === tenantId))
      );
    },
    async petExists(petId, tenantId = null) {
      return pets.some((p) => p.id === petId && (!tenantId || p.tenantId === tenantId));
    },
    async getPetAttributes(petId, tenantId = null) {
      const pet = pets.find((p) => p.id === petId && (!tenantId || p.tenantId === tenantId));
      return pet ? { breedId: pet.breedId || null, size: pet.size || null } : null;
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
  createFakeServiceRepository,
  createFakePriceRuleRepository,
  createFakeServiceCategoryReader,
  createFakeBusinessConfigReader,
  createFakeTargetExistenceReader,
  createFakeEventPublisher,
};
