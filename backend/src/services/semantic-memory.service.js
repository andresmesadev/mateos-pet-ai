const prisma = require("../lib/prisma");
const {
  generateEmbedding,
  toVectorLiteral,
} = require("./embedding.service");

const MAX_LIMIT = 20;
const MAX_CONTEXT_CHARS = 1200;
const MAX_CONTEXT_MEMORIES = 5;

/**
 * Búsqueda por similitud coseno (pgvector `<=>`) sobre MemoryEmbedding del usuario.
 * @returns {Promise<Array<{ content: string, metadata: unknown, createdAt: Date, distance: number, similarity: number }>>}
 */
const searchRelevantMemories = async ({ userId, query, limit = 5 }) => {
  try {
    const uid = String(userId || "").trim();
    const normalizedQuery = typeof query === "string" ? query.trim() : "";
    const take = Math.min(
      Math.max(parseInt(String(limit), 10) || 5, 1),
      MAX_LIMIT
    );

    if (!uid || !normalizedQuery) {
      return [];
    }

    console.log("[SemanticMemory] Generating query embedding");
    const embedding = await generateEmbedding(normalizedQuery);

    if (!embedding) {
      console.warn("[SemanticMemory] Query embedding failed; returning []");
      return [];
    }

    const vectorLiteral = toVectorLiteral(embedding);

    console.log("[SemanticMemory] Searching memories");

    const rows = await prisma.$queryRawUnsafe(
      `SELECT
        content,
        metadata,
        "createdAt",
        (embedding <=> $1::vector) AS distance,
        (1 - (embedding <=> $1::vector)) AS similarity
      FROM "MemoryEmbedding"
      WHERE "userId" = $2
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3`,
      vectorLiteral,
      uid,
      take
    );

    const memories = (rows || []).map((row) => ({
      content: row.content,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
      distance: Number(row.distance),
      similarity: Number(row.similarity),
    }));

    console.log(`[SemanticMemory] Memories found: ${memories.length}`);
    return memories;
  } catch (error) {
    console.error(
      "[SemanticMemory] searchRelevantMemories error:",
      error.message
    );
    return [];
  }
};

/**
 * Convierte resultados de búsqueda en texto para el system prompt (sin vectores).
 */
const buildSemanticContext = (memories) => {
  if (!Array.isArray(memories) || memories.length === 0) {
    return "";
  }

  const lines = [];

  for (const memory of memories.slice(0, MAX_CONTEXT_MEMORIES)) {
    const content = String(memory?.content || "").trim();
    if (!content) continue;

    let line = `- "${content}"`;

    if (memory.createdAt) {
      const created =
        memory.createdAt instanceof Date
          ? memory.createdAt
          : new Date(memory.createdAt);
      if (!Number.isNaN(created.getTime())) {
        line += ` (${created.toISOString().slice(0, 10)})`;
      }
    }

    lines.push(line);
  }

  if (lines.length === 0) {
    return "";
  }

  let text = `Memoria previa:\n${lines.join("\n")}`;

  if (text.length > MAX_CONTEXT_CHARS) {
    text = `${text.slice(0, MAX_CONTEXT_CHARS - 3)}...`;
  }

  return text;
};

module.exports = {
  searchRelevantMemories,
  buildSemanticContext,
  MAX_CONTEXT_CHARS,
};
