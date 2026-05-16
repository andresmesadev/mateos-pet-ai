const { randomUUID } = require("crypto");
const prisma = require("../lib/prisma");
const OpenAI = require("openai");

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Formato literal para columna pgvector: [0.1,0.2,...]
 */
const toVectorLiteral = (embedding) => {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding must be an array of length ${EMBEDDING_DIMENSIONS}`
    );
  }
  return `[${embedding.join(",")}]`;
};

/**
 * Genera embedding con OpenAI. Retorna null si el texto está vacío.
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
const generateEmbedding = async (text) => {
  if (typeof text !== "string") {
    return null;
  }

  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  try {
    console.log("[Embedding] Generating embedding");

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalized,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data?.[0]?.embedding;

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      console.warn(
        "[Embedding] Respuesta inválida del modelo:",
        embedding?.length
      );
      return null;
    }

    console.log("[Embedding] Embedding generated");
    return embedding;
  } catch (error) {
    console.error("[Embedding] generateEmbedding error:", error.message);
    return null;
  }
};

/**
 * Persiste embedding en MemoryEmbedding vía SQL (pgvector no es tipo Prisma nativo).
 * @returns {Promise<{ id: string }|null>}
 */
const saveMessageEmbedding = async ({
  userId,
  conversationId,
  messageId,
  content,
  metadata,
}) => {
  const uid = String(userId || "").trim();
  const body = typeof content === "string" ? content.trim() : "";

  if (!uid || !body) {
    throw new Error("userId and content are required");
  }

  try {
    const embedding = await generateEmbedding(body);

    if (!embedding) {
      console.warn("[Embedding] No se guardó: embedding vacío o falló");
      return null;
    }

    const id = randomUUID();
    const vectorLiteral = toVectorLiteral(embedding);
    const convId = conversationId ? String(conversationId) : null;
    const msgId = messageId ? String(messageId) : null;
    const metadataJson =
      metadata != null ? JSON.stringify(metadata) : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "MemoryEmbedding" (
        id,
        "userId",
        "conversationId",
        "messageId",
        content,
        embedding,
        metadata,
        "createdAt"
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::vector,
        $7::jsonb,
        NOW()
      )`,
      id,
      uid,
      convId,
      msgId,
      body,
      vectorLiteral,
      metadataJson
    );

    console.log("[Embedding] Embedding saved");
    return { id };
  } catch (error) {
    console.error("[Embedding] saveMessageEmbedding error:", error.message);
    return null;
  }
};

module.exports = {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  generateEmbedding,
  saveMessageEmbedding,
  toVectorLiteral,
};
