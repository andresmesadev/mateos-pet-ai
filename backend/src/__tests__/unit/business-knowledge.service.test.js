/**
 * Base de conocimiento del negocio (Macroetapa 2, motor conversacional):
 * verifica que la búsqueda queda acotada por tenantId (nunca cross-tenant),
 * que reutiliza generateEmbedding/toVectorLiteral sin duplicarlos, y que el
 * guardado de fragmentos persiste correctamente.
 */
jest.mock("../../lib/prisma", () => ({
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
}));

jest.mock("../../services/embedding.service", () => ({
  generateEmbedding: jest.fn(),
  toVectorLiteral: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { generateEmbedding, toVectorLiteral } = require("../../services/embedding.service");
const {
  searchRelevantKnowledge,
  buildKnowledgeContext,
  saveKnowledgeChunk,
} = require("../../services/business-knowledge.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("searchRelevantKnowledge", () => {
  test("filtra por tenantId en la consulta SQL", async () => {
    generateEmbedding.mockResolvedValue(new Array(1536).fill(0.01));
    toVectorLiteral.mockReturnValue("[0.01,...]");
    prisma.$queryRawUnsafe.mockResolvedValue([
      { content: "El horario es de 10am a 6pm", source: "horarios.md", similarity: 0.91 },
    ]);

    const result = await searchRelevantKnowledge({ tenantId: "tenant-a", query: "¿a qué hora abren?" });

    expect(result).toEqual([
      { content: "El horario es de 10am a 6pm", source: "horarios.md", similarity: 0.91 },
    ]);
    const [sql, , tenantArg] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/WHERE "tenantId" = \$2/);
    expect(tenantArg).toBe("tenant-a");
  });

  test("sin tenantId o sin query, retorna [] sin consultar la base de datos", async () => {
    expect(await searchRelevantKnowledge({ tenantId: "", query: "algo" })).toEqual([]);
    expect(await searchRelevantKnowledge({ tenantId: "tenant-a", query: "" })).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test("si falla el embedding, retorna [] sin lanzar", async () => {
    generateEmbedding.mockResolvedValue(null);
    const result = await searchRelevantKnowledge({ tenantId: "tenant-a", query: "algo" });
    expect(result).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

describe("buildKnowledgeContext", () => {
  test("arma el texto de contexto con los fragmentos encontrados", () => {
    const text = buildKnowledgeContext([
      { content: "Horario: 10am a 6pm" },
      { content: "El baño básico cuesta $30.000" },
    ]);
    expect(text).toContain("Conocimiento del negocio:");
    expect(text).toContain("Horario: 10am a 6pm");
    expect(text).toContain("El baño básico cuesta $30.000");
  });

  test("sin fragmentos, retorna cadena vacía", () => {
    expect(buildKnowledgeContext([])).toBe("");
    expect(buildKnowledgeContext(null)).toBe("");
  });
});

describe("saveKnowledgeChunk", () => {
  test("genera el embedding y persiste con tenantId", async () => {
    generateEmbedding.mockResolvedValue(new Array(1536).fill(0.02));
    toVectorLiteral.mockReturnValue("[0.02,...]");
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await saveKnowledgeChunk({
      tenantId: "tenant-a",
      source: "horarios.md",
      content: "Atendemos de 10am a 6pm todos los días.",
    });

    expect(result).toEqual({ id: expect.any(String) });
    const [sql, , tenantArg] = prisma.$executeRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO "KnowledgeChunk"/);
    expect(tenantArg).toBe("tenant-a");
  });

  test("rechaza sin tenantId o sin content", async () => {
    await expect(saveKnowledgeChunk({ tenantId: "", content: "algo" })).rejects.toThrow();
    await expect(saveKnowledgeChunk({ tenantId: "tenant-a", content: "" })).rejects.toThrow();
  });
});
