jest.mock("openai", () => {
  const mockEmbeddingsCreate = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({
    embeddings: { create: mockEmbeddingsCreate },
  }));
  ctor.__mockEmbeddingsCreate = mockEmbeddingsCreate;
  return ctor;
});

jest.mock("../../lib/prisma", () => ({
  $executeRawUnsafe: jest.fn(),
}));

const OpenAI = require("openai");
const mockEmbeddingsCreate = OpenAI.__mockEmbeddingsCreate;
const prisma = require("../../lib/prisma");
const {
  EMBEDDING_DIMENSIONS,
  generateEmbedding,
  saveMessageEmbedding,
  toVectorLiteral,
} = require("../embedding.service");

const validEmbedding = () => Array(EMBEDDING_DIMENSIONS).fill(0.1);

beforeEach(() => jest.clearAllMocks());

describe("toVectorLiteral", () => {
  test("lanza si no es un array", () => {
    expect(() => toVectorLiteral("no-array")).toThrow(
      `Embedding must be an array of length ${EMBEDDING_DIMENSIONS}`
    );
  });

  test("lanza si el array no tiene la longitud esperada", () => {
    expect(() => toVectorLiteral([0.1, 0.2])).toThrow();
  });

  test("formatea el array como literal pgvector", () => {
    expect(toVectorLiteral(validEmbedding())).toBe(`[${validEmbedding().join(",")}]`);
  });
});

describe("generateEmbedding", () => {
  test("retorna null si text no es string", async () => {
    await expect(generateEmbedding(null)).resolves.toBeNull();
    await expect(generateEmbedding(123)).resolves.toBeNull();
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
  });

  test("retorna null si text está vacío tras trim", async () => {
    await expect(generateEmbedding("   ")).resolves.toBeNull();
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
  });

  test("retorna el embedding en éxito", async () => {
    const embedding = validEmbedding();
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding }] });
    await expect(generateEmbedding("  hola  ")).resolves.toEqual(embedding);
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "hola",
      dimensions: EMBEDDING_DIMENSIONS,
    });
  });

  test("retorna null si la respuesta no trae embedding", async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [] });
    await expect(generateEmbedding("hola")).resolves.toBeNull();
  });

  test("retorna null si el embedding tiene una longitud inesperada", async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
    await expect(generateEmbedding("hola")).resolves.toBeNull();
  });

  test("retorna null (sin lanzar) si OpenAI falla", async () => {
    mockEmbeddingsCreate.mockRejectedValue(new Error("openai down"));
    await expect(generateEmbedding("hola")).resolves.toBeNull();
  });
});

describe("saveMessageEmbedding", () => {
  test("rechaza sin userId o content", async () => {
    await expect(
      saveMessageEmbedding({ userId: "", content: "hola" })
    ).rejects.toThrow("userId and content are required");
    await expect(
      saveMessageEmbedding({ userId: "u1", content: "" })
    ).rejects.toThrow("userId and content are required");
    await expect(
      saveMessageEmbedding({ userId: "u1", content: undefined })
    ).rejects.toThrow("userId and content are required");
  });

  test("retorna null si no se pudo generar el embedding", async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [] });
    await expect(
      saveMessageEmbedding({ userId: "u1", content: "hola" })
    ).resolves.toBeNull();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  test("persiste el embedding vía SQL con los parámetros correctos", async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: validEmbedding() }] });
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await saveMessageEmbedding({
      userId: "u1",
      conversationId: "c1",
      messageId: "m1",
      content: "hola",
      metadata: { role: "user" },
    });

    expect(result).toEqual({ id: expect.any(String) });
    const call = prisma.$executeRawUnsafe.mock.calls[0];
    expect(call[0]).toEqual(expect.stringContaining('INSERT INTO "MemoryEmbedding"'));
    const [, id, uid, convId, msgId, body, vectorLiteral, metadataJson] = call;
    expect(id).toEqual(expect.any(String));
    expect(uid).toBe("u1");
    expect(convId).toBe("c1");
    expect(msgId).toBe("m1");
    expect(body).toBe("hola");
    expect(vectorLiteral.startsWith("[0.1,")).toBe(true);
    expect(metadataJson).toBe(JSON.stringify({ role: "user" }));
  });

  test("usa null para conversationId, messageId y metadata cuando no se proveen", async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: validEmbedding() }] });
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await saveMessageEmbedding({ userId: "u1", content: "hola" });

    const [, , , convId, msgId, , , metadataJson] = prisma.$executeRawUnsafe.mock.calls[0];
    expect(convId).toBeNull();
    expect(msgId).toBeNull();
    expect(metadataJson).toBeNull();
  });

  test("retorna null (sin lanzar) si falla la escritura en BD", async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: validEmbedding() }] });
    prisma.$executeRawUnsafe.mockRejectedValue(new Error("db down"));
    await expect(
      saveMessageEmbedding({ userId: "u1", content: "hola" })
    ).resolves.toBeNull();
  });
});
