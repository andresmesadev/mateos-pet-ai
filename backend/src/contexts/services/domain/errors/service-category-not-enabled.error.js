const { DomainError } = require("./domain-error");

class ServiceCategoryNotEnabledError extends DomainError {
  constructor(categoryId) {
    super(
      "SERVICE_CATEGORY_NOT_ENABLED",
      `La categoría "${categoryId}" no está habilitada por los módulos activos del establecimiento.`
    );
    this.categoryId = categoryId;
  }
}

module.exports = { ServiceCategoryNotEnabledError };
