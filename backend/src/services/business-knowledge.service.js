const prisma = require("../lib/prisma");
const { randomUUID } = require("crypto");
const { generateEmbedding, toVectorLiteral } = require("./embedding.service");

/**
 * Base de conocimiento del negocio (motor conversacional). Mismo patrón que
 * semantic-memory.service.js (búsqueda por similitud con pgvector), pero
 * acotado por tenantId — conocimiento compartido por todo el
 * Establecimiento (notas, políticas, precios), no memoria de un cliente
 * específico. No duplica generateEmbedding/toVectorLiteral, los reutiliza.
 */
const MAX_LIMIT = 20;
const MAX_CONTEXT_CHARS = 1200;
const MAX_CONTEXT_CHUNKS = 5;

/**
 * @returns {Promise<Array<{ content: string, source: string|null, similarity: number }>>}
 */
const searchRelevantKnowledge = async ({ tenantId, query, limit = 5 }) => {
  try {
    const tid = String(tenantId || "").trim();
    const normalizedQuery = typeof query === "string" ? query.trim() : "";
    const take = Math.min(
      Math.max(parseInt(String(limit), 10) || 5, 1),
      MAX_LIMIT
    );

    if (!tid || !normalizedQuery) {
      return [];
    }

    const embedding = await generateEmbedding(normalizedQuery);
    if (!embedding) {
      console.warn("[BusinessKnowledge] Query embedding failed; returning []");
      return [];
    }

    const vectorLiteral = toVectorLiteral(embedding);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT
        content,
        source,
        (1 - (embedding <=> $1::vector)) AS similarity
      FROM "KnowledgeChunk"
      WHERE "tenantId" = $2
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3`,
      vectorLiteral,
      tid,
      take
    );

    return (rows || []).map((row) => ({
      content: row.content,
      source: row.source ?? null,
      similarity: Number(row.similarity),
    }));
  } catch (error) {
    console.error("[BusinessKnowledge] searchRelevantKnowledge error:", error.message);
    return [];
  }
};

/**
 * Convierte resultados de búsqueda en texto para el system prompt.
 */
const buildKnowledgeContext = (chunks) => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return "";
  }

  const lines = [];
  for (const chunk of chunks.slice(0, MAX_CONTEXT_CHUNKS)) {
    const content = String(chunk?.content || "").trim();
    if (!content) continue;
    lines.push(`- ${content}`);
  }

  if (lines.length === 0) {
    return "";
  }

  let text = `Conocimiento del negocio:\n${lines.join("\n")}`;
  if (text.length > MAX_CONTEXT_CHARS) {
    text = `${text.slice(0, MAX_CONTEXT_CHARS - 3)}...`;
  }

  return text;
};

/**
 * Persiste un fragmento con su embedding. Usado por scripts/ingest-knowledge.js.
 */
const saveKnowledgeChunk = async ({ tenantId, source, content, metadata }) => {
  const tid = String(tenantId || "").trim();
  const body = typeof content === "string" ? content.trim() : "";

  if (!tid || !body) {
    throw new Error("tenantId and content are required");
  }

  const embedding = await generateEmbedding(body);
  if (!embedding) {
    console.warn("[BusinessKnowledge] No se guardó: embedding vacío o falló");
    return null;
  }

  const id = randomUUID();
  const vectorLiteral = toVectorLiteral(embedding);
  const sourceValue = source ? String(source) : null;
  const metadataJson = metadata != null ? JSON.stringify(metadata) : null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "KnowledgeChunk" (
      id, "tenantId", source, content, embedding, metadata, "createdAt"
    ) VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb, NOW())`,
    id,
    tid,
    sourceValue,
    body,
    vectorLiteral,
    metadataJson
  );

  return { id };
};

module.exports = {
  searchRelevantKnowledge,
  buildKnowledgeContext,
  saveKnowledgeChunk,
  MAX_CONTEXT_CHARS,
};
