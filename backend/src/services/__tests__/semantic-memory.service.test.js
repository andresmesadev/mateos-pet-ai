jest.mock("../../lib/prisma", () => ({
  $queryRawUnsafe: jest.fn(),
}));

jest.mock("../embedding.service", () => ({
  generateEmbedding: jest.fn(),
  toVectorLiteral: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { generateEmbedding, toVectorLiteral } = require("../embedding.service");
const {
  searchRelevantMemories,
  buildSemanticContext,
  MAX_CONTEXT_CHARS,
} = require("../semantic-memory.service");

beforeEach(() => jest.clearAllMocks());

describe("searchRelevantMemories", () => {
  test("retorna [] sin generar embedding si falta userId o query", async () => {
    await expect(searchRelevantMemories({ userId: "", query: "algo" })).resolves.toEqual([]);
    await expect(searchRelevantMemories({ userId: "u1", query: "  " })).resolves.toEqual([]);
    await expect(searchRelevantMemories({ userId: "u1", query: 123 })).resolves.toEqual([]);
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  test("retorna [] si no se pudo generar el embedding de la query", async () => {
    generateEmbedding.mockResolvedValue(null);
    await expect(
      searchRelevantMemories({ userId: "u1", query: "algo" })
    ).resolves.toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test("busca por similitud coseno y mapea las filas a distance/similarity numéricos", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    toVectorLiteral.mockReturnValue("[0.1,0.2]");
    prisma.$queryRawUnsafe.mockResolvedValue([
      { content: "recuerdo 1", metadata: { a: 1 }, createdAt: new Date("2026-01-01"), distance: "0.1", similarity: "0.9" },
    ]);

    const result = await searchRelevantMemories({ userId: "u1", query: "algo", limit: 3 });

    expect(result).toEqual([
      {
        content: "recuerdo 1",
        metadata: { a: 1 },
        createdAt: new Date("2026-01-01"),
        distance: 0.1,
        similarity: 0.9,
      },
    ]);
    const call = prisma.$queryRawUnsafe.mock.calls[0];
    expect(call[1]).toBe("[0.1,0.2]");
    expect(call[2]).toBe("u1");
    expect(call[3]).toBe(3);
  });

  test("usa metadata null si la fila no la trae", async () => {
    generateEmbedding.mockResolvedValue([0.1]);
    toVectorLiteral.mockReturnValue("[0.1]");
    prisma.$queryRawUnsafe.mockResolvedValue([
      { content: "x", metadata: null, createdAt: new Date(), distance: 0, similarity: 1 },
    ]);
    const result = await searchRelevantMemories({ userId: "u1", query: "algo" });
    expect(result[0].metadata).toBeNull();
  });

  test("acota limit al rango [1, MAX_LIMIT] y usa 5 por defecto si es inválido", async () => {
    generateEmbedding.mockResolvedValue([0.1]);
    toVectorLiteral.mockReturnValue("[0.1]");
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await searchRelevantMemories({ userId: "u1", query: "algo", limit: -3 });
    expect(prisma.$queryRawUnsafe.mock.calls[0][3]).toBe(1);

    await searchRelevantMemories({ userId: "u1", query: "algo", limit: 999 });
    expect(prisma.$queryRawUnsafe.mock.calls[1][3]).toBe(20);

    await searchRelevantMemories({ userId: "u1", query: "algo", limit: "no-numero" });
    expect(prisma.$queryRawUnsafe.mock.calls[2][3]).toBe(5);
  });

  test("retorna [] si prisma resuelve sin filas (undefined)", async () => {
    generateEmbedding.mockResolvedValue([0.1]);
    toVectorLiteral.mockReturnValue("[0.1]");
    prisma.$queryRawUnsafe.mockResolvedValue(undefined);
    await expect(searchRelevantMemories({ userId: "u1", query: "algo" })).resolves.toEqual([]);
  });

  test("retorna [] (sin lanzar) si prisma falla", async () => {
    generateEmbedding.mockResolvedValue([0.1]);
    toVectorLiteral.mockReturnValue("[0.1]");
    prisma.$queryRawUnsafe.mockRejectedValue(new Error("db down"));
    await expect(searchRelevantMemories({ userId: "u1", query: "algo" })).resolves.toEqual([]);
  });
});

describe("buildSemanticContext", () => {
  test("retorna '' si memories no es un array o está vacío", () => {
    expect(buildSemanticContext(null)).toBe("");
    expect(buildSemanticContext([])).toBe("");
  });

  test("arma el texto con hasta MAX_CONTEXT_MEMORIES (5) recuerdos, con fecha", () => {
    const memories = Array.from({ length: 7 }, (_, i) => ({
      content: `recuerdo ${i}`,
      createdAt: new Date("2026-03-05T00:00:00Z"),
    }));
    const text = buildSemanticContext(memories);
    const lines = text.split("\n").slice(1);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('- "recuerdo 0" (2026-03-05)');
  });

  test("omite recuerdos con content vacío", () => {
    const text = buildSemanticContext([{ content: "  " }, { content: "válido" }]);
    expect(text).toBe('Memoria previa:\n- "válido"');
  });

  test("retorna '' si todos los recuerdos tienen content vacío", () => {
    expect(buildSemanticContext([{ content: "" }, { content: "   " }])).toBe("");
  });

  test("omite la fecha si createdAt es inválida", () => {
    const text = buildSemanticContext([{ content: "x", createdAt: "no-es-fecha" }]);
    expect(text).toBe('Memoria previa:\n- "x"');
  });

  test("acepta createdAt como string parseable", () => {
    const text = buildSemanticContext([{ content: "x", createdAt: "2026-03-05T00:00:00Z" }]);
    expect(text).toBe('Memoria previa:\n- "x" (2026-03-05)');
  });

  test("trunca el texto a MAX_CONTEXT_CHARS agregando '...'", () => {
    const memories = [{ content: "a".repeat(MAX_CONTEXT_CHARS * 2) }];
    const text = buildSemanticContext(memories);
    expect(text.length).toBe(MAX_CONTEXT_CHARS);
    expect(text.endsWith("...")).toBe(true);
  });
});
