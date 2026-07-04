const { DomainError } = require("./domain-error");
const {
  VALID_ACTION_TYPES,
  InvalidAutomationRuleAttributesError,
  AutomationRuleNotFoundError,
  TriggerEventTypeNotFoundError,
} = require("./automation-rule.errors");
const { InvalidAutomationTemplateAttributesError, AutomationTemplateNotFoundError } = require("./automation-template.errors");

module.exports = {
  DomainError,
  VALID_ACTION_TYPES,
  InvalidAutomationRuleAttributesError,
  AutomationRuleNotFoundError,
  TriggerEventTypeNotFoundError,
  InvalidAutomationTemplateAttributesError,
  AutomationTemplateNotFoundError,
};
