const { DomainError } = require("./domain-error");

class PriceRuleTargetNotFoundError extends DomainError {
  constructor(targetType, targetId) {
    super(
      "PRICE_RULE_TARGET_NOT_FOUND",
      `El destino "${targetId}" (${targetType}) referenciado por la regla de precio no existe.`
    );
    this.targetType = targetType;
    this.targetId = targetId;
  }
}

module.exports = { PriceRuleTargetNotFoundError };
