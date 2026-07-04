const { createRegisterAutomationRuleUseCase } = require("../application/use-cases/register-automation-rule.usecase");
const { InvalidAutomationRuleAttributesError, TriggerEventTypeNotFoundError } = require("../domain/errors");

const eventPublisher = { publish: async () => {} };

function buildDeps({ eventTypeExists = true } = {}) {
  const rules = [];
  const automationRuleRepository = {
    create: async (data) => {
      const row = { id: `rule-${rules.length + 1}`, ...data };
      rules.push(row);
      return row;
    },
  };
  const eventTypeLookup = {
    findActiveByName: async (name) => (eventTypeExists ? { id: "et-1", name, active: true } : null),
  };
  return { automationRuleRepository, eventTypeLookup, rules };
}

describe("RegisterAutomationRuleUseCase", () => {
  test("rechaza actionType inválido", async () => {
    const { automationRuleRepository, eventTypeLookup } = buildDeps();
    const execute = createRegisterAutomationRuleUseCase({ automationRuleRepository, eventTypeLookup, eventPublisher });
    await expect(
      execute({ name: "r1", triggerEventTypeName: "CitaCompletada", actionType: "no-existe", actionConfig: {} })
    ).rejects.toBeInstanceOf(InvalidAutomationRuleAttributesError);
  });

  test("rechaza condition anidada/array", async () => {
    const { automationRuleRepository, eventTypeLookup } = buildDeps();
    const execute = createRegisterAutomationRuleUseCase({ automationRuleRepository, eventTypeLookup, eventPublisher });
    await expect(
      execute({
        name: "r1",
        triggerEventTypeName: "CitaCompletada",
        condition: [1, 2],
        actionType: "asignar_tarea_empleado",
        actionConfig: { digitalEmployeeId: "de-1" },
      })
    ).rejects.toBeInstanceOf(InvalidAutomationRuleAttributesError);
  });

  test("rechaza disparador inexistente o inactivo", async () => {
    const { automationRuleRepository, eventTypeLookup } = buildDeps({ eventTypeExists: false });
    const execute = createRegisterAutomationRuleUseCase({ automationRuleRepository, eventTypeLookup, eventPublisher });
    await expect(
      execute({ name: "r1", triggerEventTypeName: "NoExiste", actionType: "asignar_tarea_empleado", actionConfig: { digitalEmployeeId: "de-1" } })
    ).rejects.toBeInstanceOf(TriggerEventTypeNotFoundError);
  });

  test("registra correctamente resolviendo triggerEventTypeId", async () => {
    const { automationRuleRepository, eventTypeLookup, rules } = buildDeps();
    const execute = createRegisterAutomationRuleUseCase({ automationRuleRepository, eventTypeLookup, eventPublisher });
    const { rule } = await execute({
      name: "Asignar recepcionista",
      triggerEventTypeName: "CitaCompletada",
      actionType: "asignar_tarea_empleado",
      actionConfig: { digitalEmployeeId: "de-1" },
    });
    expect(rule.triggerEventTypeId).toBe("et-1");
    expect(rule.active).toBe(true);
    expect(rules).toHaveLength(1);
  });
});
