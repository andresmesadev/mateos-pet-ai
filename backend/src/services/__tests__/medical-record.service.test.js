jest.mock("../../lib/prisma", () => ({
  medicalRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
}));

const prisma = require("../../lib/prisma");
const {
  createRecord,
  getRecordsByPet,
  getRecordsByType,
  formatRecordsForWhatsApp,
  recordExists,
} = require("../medical-record.service");

beforeEach(() => jest.clearAllMocks());

describe("createRecord", () => {
  test("rechaza sin petId", async () => {
    await expect(createRecord("", "vaccine", "Rabia")).rejects.toThrow("petId is required");
  });

  test("rechaza un type inválido", async () => {
    await expect(createRecord("pet-1", "invalid-type", "Rabia")).rejects.toThrow(
      "type must be one of"
    );
  });

  test("rechaza sin title", async () => {
    await expect(createRecord("pet-1", "vaccine", "")).rejects.toThrow("title is required");
  });

  test("propaga fecha inválida", async () => {
    await expect(
      createRecord("pet-1", "vaccine", "Rabia", null, "no-es-fecha")
    ).rejects.toThrow("Invalid date");
    expect(prisma.medicalRecord.create).not.toHaveBeenCalled();
  });

  test("crea el registro con campos mínimos", async () => {
    prisma.medicalRecord.create.mockResolvedValue({ id: "rec-1" });
    await createRecord("pet-1", "VACCINE", "  Rabia  ");
    expect(prisma.medicalRecord.create).toHaveBeenCalledWith({
      data: {
        petId: "pet-1",
        type: "vaccine",
        title: "Rabia",
        detail: null,
        date: null,
        reason: null,
        findings: null,
        diagnosis: null,
        treatment: null,
        recommendations: null,
        weight: null,
        nextControlAt: null,
        staffId: null,
      },
    });
  });

  test("crea el registro con datos clínicos completos", async () => {
    prisma.medicalRecord.create.mockResolvedValue({ id: "rec-2" });
    await createRecord("pet-1", "consultation", "Chequeo", "detalle", "2026-01-15", {
      reason: " fiebre ",
      findings: "letargo",
      diagnosis: "gripe",
      treatment: "reposo",
      recommendations: "control en 7 días",
      weight: "4.5",
      nextControlAt: "2026-01-22",
      staffId: "staff-1",
    });
    const call = prisma.medicalRecord.create.mock.calls[0][0];
    expect(call.data.reason).toBe("fiebre");
    expect(call.data.weight).toBe(4.5);
    expect(call.data.staffId).toBe("staff-1");
    expect(call.data.date).toBeInstanceOf(Date);
    expect(call.data.nextControlAt).toBeInstanceOf(Date);
  });

  test("acepta un Date ya instanciado", async () => {
    prisma.medicalRecord.create.mockResolvedValue({ id: "rec-3" });
    const date = new Date("2026-01-15");
    await createRecord("pet-1", "note", "Nota", null, date);
    expect(prisma.medicalRecord.create.mock.calls[0][0].data.date).toBe(date);
  });

  test("propaga el error de prisma", async () => {
    prisma.medicalRecord.create.mockRejectedValue(new Error("db down"));
    await expect(createRecord("pet-1", "note", "Nota")).rejects.toThrow("db down");
  });
});

describe("getRecordsByPet", () => {
  test("rechaza sin petId", async () => {
    await expect(getRecordsByPet("")).rejects.toThrow("petId is required");
  });

  test("retorna los registros del pet ordenados", async () => {
    prisma.medicalRecord.findMany.mockResolvedValue([{ id: "rec-1" }]);
    await expect(getRecordsByPet("pet-1")).resolves.toEqual([{ id: "rec-1" }]);
    expect(prisma.medicalRecord.findMany).toHaveBeenCalledWith({
      where: { petId: "pet-1" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.medicalRecord.findMany.mockRejectedValue(new Error("db down"));
    await expect(getRecordsByPet("pet-1")).rejects.toThrow("db down");
  });
});

describe("getRecordsByType", () => {
  test("rechaza sin petId", async () => {
    await expect(getRecordsByType("", "vaccine")).rejects.toThrow("petId is required");
  });

  test("rechaza un type inválido", async () => {
    await expect(getRecordsByType("pet-1", "invalid")).rejects.toThrow("type must be one of");
  });

  test("retorna los registros filtrados por type", async () => {
    prisma.medicalRecord.findMany.mockResolvedValue([{ id: "rec-1", type: "vaccine" }]);
    await expect(getRecordsByType("pet-1", "VACCINE")).resolves.toEqual([
      { id: "rec-1", type: "vaccine" },
    ]);
    expect(prisma.medicalRecord.findMany).toHaveBeenCalledWith({
      where: { petId: "pet-1", type: "vaccine" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.medicalRecord.findMany.mockRejectedValue(new Error("db down"));
    await expect(getRecordsByType("pet-1", "vaccine")).rejects.toThrow("db down");
  });
});

describe("formatRecordsForWhatsApp", () => {
  test("muestra los 4 mensajes de sección vacía sin registros", () => {
    const text = formatRecordsForWhatsApp([]);
    expect(text).toContain("Sin alergias registradas.");
    expect(text).toContain("Sin vacunas registradas.");
    expect(text).toContain("Sin consultas registradas.");
    expect(text).toContain("Sin notas registradas.");
  });

  test("no falla si records es null/undefined", () => {
    expect(formatRecordsForWhatsApp(null)).toContain("Sin alergias registradas.");
    expect(formatRecordsForWhatsApp()).toContain("Sin alergias registradas.");
  });

  test("formatea la fecha de un registro con Date ya instanciado", () => {
    const text = formatRecordsForWhatsApp([
      { type: "vaccine", title: "Rabia", date: new Date("2026-03-05") },
    ]);
    expect(text).toContain("• Rabia — 05/03/2026");
  });

  test("agrupa registros por type e ignora tipos desconocidos", () => {
    const text = formatRecordsForWhatsApp([
      { type: "vaccine", title: "Rabia", date: "2026-01-15" },
      { type: "deworming", title: "Desparasitación" },
      { type: "unknown-type", title: "Ignorado" },
    ]);
    expect(text).toContain("• Rabia — 15/01/2026");
    expect(text).not.toContain("Ignorado");
    expect(text).toContain("Sin alergias registradas.");
  });

  test("filtra por filterType cuando se pasa", () => {
    const text = formatRecordsForWhatsApp(
      [{ type: "vaccine", title: "Rabia" }],
      { filterType: "vaccine" }
    );
    expect(text).toContain("Vacunas");
    expect(text).not.toContain("Alergias");
  });

  test("omite la fecha en la línea si es inválida o ausente", () => {
    const text = formatRecordsForWhatsApp([
      { type: "note", title: "Sin fecha" },
      { type: "note", title: "Fecha inválida", date: "no-es-fecha" },
    ]);
    expect(text).toContain("• Sin fecha\n• Fecha inválida");
  });
});

describe("recordExists", () => {
  test("retorna false sin consultar prisma si falta petId, type o title", async () => {
    await expect(recordExists("", "vaccine", "Rabia")).resolves.toBe(false);
    await expect(recordExists("pet-1", "", "Rabia")).resolves.toBe(false);
    await expect(recordExists("pet-1", "vaccine", "")).resolves.toBe(false);
    expect(prisma.medicalRecord.findFirst).not.toHaveBeenCalled();
  });

  test("retorna true si el registro existe", async () => {
    prisma.medicalRecord.findFirst.mockResolvedValue({ id: "rec-1" });
    await expect(recordExists("pet-1", "vaccine", "Rabia")).resolves.toBe(true);
    expect(prisma.medicalRecord.findFirst).toHaveBeenCalledWith({
      where: {
        petId: "pet-1",
        type: "vaccine",
        title: { equals: "Rabia", mode: "insensitive" },
      },
      select: { id: true },
    });
  });

  test("retorna false si el registro no existe", async () => {
    prisma.medicalRecord.findFirst.mockResolvedValue(null);
    await expect(recordExists("pet-1", "vaccine", "Rabia")).resolves.toBe(false);
  });

  test("propaga el error de prisma", async () => {
    prisma.medicalRecord.findFirst.mockRejectedValue(new Error("db down"));
    await expect(recordExists("pet-1", "vaccine", "Rabia")).rejects.toThrow("db down");
  });
});
