const { createEvaluateAndExecuteRulesMechanism } = require("../application/use-cases/evaluate-and-execute-rules.mechanism");

const silentLogger = { error: () => {} };

function buildDeps({ rules = [], actionThrows = false, listThrows = false, deliveryThrows = false } = {}) {
  const executions = [];
  const deliveries = [];

  const automationRuleRepository = {
    listActiveByTrigger: async () => {
      if (listThrows) throw new Error("fallo de infraestructura al leer Reglas");
      return rules;
    },
  };
  const automationExecutionRepository = {
    create: async (data) => {
      executions.push(data);
      return { id: `exec-${executions.length}`, ...data };
    },
    // Entregable 5.1 — idempotencia del reintento: sin ejecuciones previas
    // registradas en estos tests, ninguna Regla se considera ya exitosa.
    hasSuccessfulExecution: async (automationRuleId, domainEventId) =>
      executions.some(
        (e) => e.automationRuleId === automationRuleId && e.domainEventId === domainEventId && e.status === "success"
      ),
  };
  const actionExecutor = {
    execute: async (actionType) => {
      if (actionThrows) throw new Error(`el proveedor de "${actionType}" no confirmó`);
      return { ok: true };
    },
  };
  const eventDelivery = {
    register: async (data) => {
      if (deliveryThrows) throw new Error("fallo al registrar la Entrega de Evento");
      deliveries.push(data);
      return data;
    },
  };

  return { automationRuleRepository, automationExecutionRepository, actionExecutor, eventDelivery, executions, deliveries };
}

describe("evaluateAndExecuteRules", () => {
  test("Regla sin condición se ejecuta y registra Ejecución exitosa", async () => {
    const deps = buildDeps({ rules: [{ id: "rule-1", condition: null, actionType: "asignar_tarea_empleado", actionConfig: {} }] });
    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });

    await execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: {} }, {});

    expect(deps.executions).toHaveLength(1);
    expect(deps.executions[0].status).toBe("success");
    expect(deps.deliveries).toHaveLength(1);
    expect(deps.deliveries[0]).toMatchObject({ domainEventId: "de-1", consumer: "Automatizaciones", status: "delivered" });
  });

  test("Regla cuya condición no coincide no genera Ejecución", async () => {
    const deps = buildDeps({
      rules: [{ id: "rule-1", condition: { priceSource: "manual_override" }, actionType: "asignar_tarea_empleado", actionConfig: {} }],
    });
    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });

    await execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: { priceSource: "service_base_price" } }, {});

    expect(deps.executions).toHaveLength(0);
    expect(deps.deliveries).toHaveLength(1);
  });

  test("fallo de la acción se registra como Ejecución fallida y no detiene la Entrega de Evento", async () => {
    const deps = buildDeps({
      rules: [{ id: "rule-1", condition: null, actionType: "enviar_mensaje", actionConfig: {} }],
      actionThrows: true,
    });
    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });

    await execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: {} }, {});

    expect(deps.executions).toHaveLength(1);
    expect(deps.executions[0].status).toBe("failed");
    expect(deps.executions[0].failureReason).toMatch(/no confirmó/);
    expect(deps.deliveries).toHaveLength(1);
    expect(deps.deliveries[0].status).toBe("delivered");
  });

  test("fallo al leer Reglas nunca se propaga — se registra como Entrega fallida", async () => {
    const deps = buildDeps({ listThrows: true });
    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });

    await expect(
      execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: {} }, {})
    ).resolves.toBeUndefined();

    expect(deps.deliveries).toHaveLength(1);
    expect(deps.deliveries[0].status).toBe("failed");
  });

  test("fallo al registrar la Entrega de Evento nunca se propaga", async () => {
    const deps = buildDeps({ listThrows: true, deliveryThrows: true });
    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });

    await expect(
      execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: {} }, {})
    ).resolves.toBeUndefined();
  });

  test("varias Reglas: el fallo de una no impide que se evalúen las demás", async () => {
    const deps = buildDeps({
      rules: [
        { id: "rule-1", condition: null, actionType: "enviar_mensaje", actionConfig: {} },
        { id: "rule-2", condition: null, actionType: "asignar_tarea_empleado", actionConfig: {} },
      ],
    });
    let call = 0;
    deps.actionExecutor.execute = async (actionType) => {
      call += 1;
      if (actionType === "enviar_mensaje") throw new Error("el proveedor de WhatsApp no confirmó");
      return { ok: true };
    };

    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });
    await execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: {} }, {});

    expect(call).toBe(2);
    expect(deps.executions).toHaveLength(2);
    expect(deps.executions.find((e) => e.automationRuleId === "rule-1").status).toBe("failed");
    expect(deps.executions.find((e) => e.automationRuleId === "rule-2").status).toBe("success");
  });

  // Entregable 5.1 — Outbox de Eventos de Dominio: idempotencia del reintento.
  test("reintento: una Regla ya exitosa para el mismo Evento no se re-ejecuta", async () => {
    const deps = buildDeps({
      rules: [
        { id: "rule-1", condition: null, actionType: "enviar_mensaje", actionConfig: {} },
        { id: "rule-2", condition: null, actionType: "asignar_tarea_empleado", actionConfig: {} },
      ],
    });
    // Simula que rule-1 ya tuvo éxito en un intento anterior para este Evento.
    deps.executions.push({ automationRuleId: "rule-1", domainEventId: "de-1", status: "success" });

    let calls = [];
    deps.actionExecutor.execute = async (actionType, _config, _payload, _tenantId) => {
      calls.push(actionType);
      return { ok: true };
    };

    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });
    await execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: {} }, {});

    // Solo rule-2 se ejecuta; rule-1 se omite porque ya tuvo éxito.
    expect(calls).toEqual(["asignar_tarea_empleado"]);
    expect(deps.executions.filter((e) => e.automationRuleId === "rule-1")).toHaveLength(1);
    expect(deps.deliveries).toHaveLength(1);
    expect(deps.deliveries[0].status).toBe("delivered");
  });

  test("reintento: una Regla previamente fallida sí se re-ejecuta", async () => {
    const deps = buildDeps({
      rules: [{ id: "rule-1", condition: null, actionType: "enviar_mensaje", actionConfig: {} }],
    });
    deps.executions.push({ automationRuleId: "rule-1", domainEventId: "de-1", status: "failed" });

    const execute = createEvaluateAndExecuteRulesMechanism({ ...deps, logger: silentLogger });
    await execute({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventPayload: {} }, {});

    const rule1Executions = deps.executions.filter((e) => e.automationRuleId === "rule-1");
    expect(rule1Executions).toHaveLength(2);
    expect(rule1Executions[1].status).toBe("success");
  });
});
