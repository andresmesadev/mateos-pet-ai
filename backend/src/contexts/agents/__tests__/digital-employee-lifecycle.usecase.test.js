const { createRegisterDigitalEmployeeUseCase } = require("../application/use-cases/register-digital-employee.usecase");
const { createPauseDigitalEmployeeUseCase } = require("../application/use-cases/pause-digital-employee.usecase");
const { createReactivateDigitalEmployeeUseCase } = require("../application/use-cases/reactivate-digital-employee.usecase");
const {
  InvalidDigitalEmployeeAttributesError,
  DigitalEmployeeNotFoundError,
  DigitalEmployeeAlreadyPausedError,
  DigitalEmployeeAlreadyActiveError,
} = require("../domain/errors");

function buildRepository(initial = []) {
  const rows = [...initial];
  return {
    rows,
    create: async (data) => {
      const row = { id: `de-${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    pause: async (id) => {
      const row = rows.find((r) => r.id === id);
      row.status = "pausado";
      return row;
    },
    reactivate: async (id) => {
      const row = rows.find((r) => r.id === id);
      row.status = "activo";
      return row;
    },
  };
}

const eventPublisher = { publish: async () => {} };

describe("RegisterDigitalEmployeeUseCase", () => {
  test("rechaza specialization fuera del catálogo", async () => {
    const digitalEmployeeRepository = buildRepository();
    const execute = createRegisterDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    await expect(execute({ specialization: "inexistente" })).rejects.toBeInstanceOf(
      InvalidDigitalEmployeeAttributesError
    );
  });

  test("registra activo por defecto", async () => {
    const digitalEmployeeRepository = buildRepository();
    const execute = createRegisterDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    const { digitalEmployee } = await execute({ specialization: "recepcionista" });
    expect(digitalEmployee.status).toBe("activo");
  });
});

describe("PauseDigitalEmployeeUseCase / ReactivateDigitalEmployeeUseCase", () => {
  test("pausar un Empleado Digital inexistente rechaza con DigitalEmployeeNotFoundError", async () => {
    const digitalEmployeeRepository = buildRepository();
    const execute = createPauseDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    await expect(execute({ digitalEmployeeId: "no-existe" })).rejects.toBeInstanceOf(DigitalEmployeeNotFoundError);
  });

  test("pausar dos veces rechaza con DigitalEmployeeAlreadyPausedError", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-1", status: "activo" }]);
    const pause = createPauseDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    await pause({ digitalEmployeeId: "de-1" });
    await expect(pause({ digitalEmployeeId: "de-1" })).rejects.toBeInstanceOf(DigitalEmployeeAlreadyPausedError);
  });

  test("reactivar un Empleado Digital ya activo rechaza con DigitalEmployeeAlreadyActiveError", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-1", status: "activo" }]);
    const reactivate = createReactivateDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    await expect(reactivate({ digitalEmployeeId: "de-1" })).rejects.toBeInstanceOf(DigitalEmployeeAlreadyActiveError);
  });

  // Entregable 6.5 — Automatizaciones y Empleados Digitales Multi-Establecimiento.
  test("pausar un Empleado Digital de otro tenant rechaza como si no existiera", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-1", tenantId: "t2", status: "activo" }]);
    const pause = createPauseDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    await expect(pause({ digitalEmployeeId: "de-1", tenantId: "t1" })).rejects.toBeInstanceOf(DigitalEmployeeNotFoundError);
  });

  test("reactivar un Empleado Digital de otro tenant rechaza como si no existiera", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-1", tenantId: "t2", status: "pausado" }]);
    const reactivate = createReactivateDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    await expect(reactivate({ digitalEmployeeId: "de-1", tenantId: "t1" })).rejects.toBeInstanceOf(DigitalEmployeeNotFoundError);
  });

  test("pausar/reactivar del mismo tenant funciona con verificación explícita", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-1", tenantId: "t1", status: "activo" }]);
    const pause = createPauseDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
    const { digitalEmployee } = await pause({ digitalEmployeeId: "de-1", tenantId: "t1" });
    expect(digitalEmployee.status).toBe("pausado");
  });
});
