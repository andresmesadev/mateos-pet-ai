const { DomainError } = require("./domain-error");
const { ServiceNotFoundError } = require("./service-not-found.error");
const { DuplicateServiceNameError } = require("./duplicate-service-name.error");
const { InvalidServiceAttributesError } = require("./invalid-service-attributes.error");
const { ServiceCategoryNotEnabledError } = require("./service-category-not-enabled.error");
const { ServiceAlreadyInactiveError } = require("./service-already-inactive.error");
const { ServiceInactiveError } = require("./service-inactive.error");
const { InvalidPriceError } = require("./invalid-price.error");
const { PriceRuleTargetNotFoundError } = require("./price-rule-target-not-found.error");
const { DuplicatePriceRuleError } = require("./duplicate-price-rule.error");

module.exports = {
  DomainError,
  ServiceNotFoundError,
  DuplicateServiceNameError,
  InvalidServiceAttributesError,
  ServiceCategoryNotEnabledError,
  ServiceAlreadyInactiveError,
  ServiceInactiveError,
  InvalidPriceError,
  PriceRuleTargetNotFoundError,
  DuplicatePriceRuleError,
};
