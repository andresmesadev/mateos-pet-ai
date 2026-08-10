const { createActivateAutomationRuleUseCase } = require("../application/use-cases/activate-automation-rule.usecase");
const { createDeactivateAutomationRuleUseCase } = require("../application/use-cases/deactivate-automation-rule.usecase");
const { AutomationRuleNotFoundError } = require("../domain/errors");

const eventPublisher = { publish: async () => {} };

function buildRepository(initial = []) {
  const rows = [...initial];
  return {
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    activate: async (id) => {
      const row = rows.find((r) => r.id === id);
      row.active = true;
      return row;
    },
    deactivate: async (id) => {
      const row = rows.find((r) => r.id === id);
      row.active = false;
      return row;
    },
  };
}

describe("ActivateAutomationRuleUseCase", () => {
  test("rechaza activar una Regla inexistente", async () => {
    const automationRuleRepository = buildRepository();
    const execute = createActivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
    await expect(execute({ automationRuleId: "no-existe" })).rejects.toBeInstanceOf(AutomationRuleNotFoundError);
  });

  test("activa una Regla del mismo tenant", async () => {
    const automationRuleRepository = buildRepository([{ id: "r1", tenantId: "t1", active: false }]);
    const execute = createActivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
    const { rule } = await execute({ automationRuleId: "r1", tenantId: "t1" });
    expect(rule.active).toBe(true);
  });

  test("Entregable 6.5 — rechaza activar una Regla de otro tenant como si no existiera", async () => {
    const automationRuleRepository = buildRepository([{ id: "r1", tenantId: "t2", active: false }]);
    const execute = createActivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
    await expect(execute({ automationRuleId: "r1", tenantId: "t1" })).rejects.toBeInstanceOf(AutomationRuleNotFoundError);
  });

  test("sin tenantId (uso interno) no filtra por tenant", async () => {
    const automationRuleRepository = buildRepository([{ id: "r1", tenantId: "t2", active: false }]);
    const execute = createActivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
    const { rule } = await execute({ automationRuleId: "r1" });
    expect(rule.active).toBe(true);
  });
});

describe("DeactivateAutomationRuleUseCase", () => {
  test("rechaza desactivar una Regla inexistente", async () => {
    const automationRuleRepository = buildRepository();
    const execute = createDeactivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
    await expect(execute({ automationRuleId: "no-existe" })).rejects.toBeInstanceOf(AutomationRuleNotFoundError);
  });

  test("desactiva una Regla del mismo tenant", async () => {
    const automationRuleRepository = buildRepository([{ id: "r1", tenantId: "t1", active: true }]);
    const execute = createDeactivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
    const { rule } = await execute({ automationRuleId: "r1", tenantId: "t1" });
    expect(rule.active).toBe(false);
  });

  test("Entregable 6.5 — rechaza desactivar una Regla de otro tenant como si no existiera", async () => {
    const automationRuleRepository = buildRepository([{ id: "r1", tenantId: "t2", active: true }]);
    const execute = createDeactivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
    await expect(execute({ automationRuleId: "r1", tenantId: "t1" })).rejects.toBeInstanceOf(AutomationRuleNotFoundError);
  });
});
