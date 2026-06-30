const prisma = require("../../../../lib/prisma");
const { PriceRuleRepositoryPort } = require("../../application/ports/price-rule-repository.port");

const UNIQUE_PARTIAL_INDEX_NAME = "PriceRule_active_target_unique";

function isUniqueActiveTargetViolation(err) {
  const message = String(err?.message || "");
  const target = err?.meta?.target;
  return (
    message.includes(UNIQUE_PARTIAL_INDEX_NAME) ||
    (Array.isArray(target) && target.includes(UNIQUE_PARTIAL_INDEX_NAME)) ||
    target === UNIQUE_PARTIAL_INDEX_NAME
  );
}

class PrismaPriceRuleRepository extends PriceRuleRepositoryPort {
  async listByService(serviceId) {
    return prisma.priceRule.findMany({ where: { serviceId } });
  }

  async findActiveByTarget(serviceId, targetType, targetId) {
    return prisma.priceRule.findFirst({
      where: { serviceId, targetType, targetId, active: true },
    });
  }

  async create(data) {
    try {
      return await prisma.priceRule.create({ data });
    } catch (err) {
      if (isUniqueActiveTargetViolation(err)) {
        const wrapped = new Error("Violación del índice único parcial de PriceRule");
        wrapped.code = "UNIQUE_PRICE_RULE_VIOLATION";
        throw wrapped;
      }
      throw err;
    }
  }

  async updatePrice(priceRuleId, newPrice) {
    return prisma.priceRule.update({ where: { id: priceRuleId }, data: { price: newPrice } });
  }
}

module.exports = { PrismaPriceRuleRepository };
