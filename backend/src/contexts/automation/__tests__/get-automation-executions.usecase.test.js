const { createGetAutomationExecutionsUseCase } = require("../application/use-cases/get-automation-executions.usecase");
const { AutomationRuleNotFoundError } = require("../domain/errors");

function buildDeps({ rules = [], executions = [] } = {}) {
  return {
    automationRuleRepository: {
      findById: async (id) => rules.find((r) => r.id === id) ?? null,
    },
    automationExecutionRepository: {
      listByRule: async (automationRuleId) => executions.filter((e) => e.automationRuleId === automationRuleId),
    },
  };
}

describe("GetAutomationExecutionsUseCase", () => {
  test("rechaza consultar ejecuciones de una Regla inexistente", async () => {
    const { automationRuleRepository, automationExecutionRepository } = buildDeps();
    const execute = createGetAutomationExecutionsUseCase({ automationRuleRepository, automationExecutionRepository });
    await expect(execute({ automationRuleId: "no-existe" })).rejects.toBeInstanceOf(AutomationRuleNotFoundError);
  });

  test("lista las ejecuciones de una Regla del mismo tenant", async () => {
    const { automationRuleRepository, automationExecutionRepository } = buildDeps({
      rules: [{ id: "r1", tenantId: "t1" }],
      executions: [{ id: "e1", automationRuleId: "r1" }],
    });
    const execute = createGetAutomationExecutionsUseCase({ automationRuleRepository, automationExecutionRepository });
    const { executions } = await execute({ automationRuleId: "r1", tenantId: "t1" });
    expect(executions).toHaveLength(1);
  });

  test("Entregable 6.5 — rechaza consultar ejecuciones de una Regla de otro tenant como si no existiera", async () => {
    const { automationRuleRepository, automationExecutionRepository } = buildDeps({
      rules: [{ id: "r1", tenantId: "t2" }],
      executions: [{ id: "e1", automationRuleId: "r1" }],
    });
    const execute = createGetAutomationExecutionsUseCase({ automationRuleRepository, automationExecutionRepository });
    await expect(execute({ automationRuleId: "r1", tenantId: "t1" })).rejects.toBeInstanceOf(AutomationRuleNotFoundError);
  });
});
