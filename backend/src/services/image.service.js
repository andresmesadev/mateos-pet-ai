const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const axios = require("axios");
const OpenAI = require("openai");
const logger = require("../lib/logger");

const GRAPH_API_VERSION = "v25.0";
const TEMP_DIR = path.join(__dirname, "../../uploads/temp");

let _client = null;
const getClient = () => {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
};

const getAccessToken = () =>
  String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();

const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
};

const safeUnlink = async (filepath) => {
  if (!filepath) return;
  try {
    await fs.promises.unlink(filepath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.warn("[Image] Could not delete temp file:", error.message);
    }
  }
};

const extFromMime = (mimeType) => {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  return ".jpg";
};

/**
 * Descarga una imagen de WhatsApp desde la Graph API de Meta.
 * @param {string} mediaId
 * @returns {Promise<{filepath: string, mimeType: string}|null>}
 */
const downloadWhatsAppImage = async (mediaId) => {
  const id = String(mediaId || "").trim();
  const accessToken = getAccessToken();

  if (!id) {
    logger.error("[Image] mediaId is required");
    return null;
  }

  if (!accessToken) {
    logger.error("[Image] WHATSAPP_ACCESS_TOKEN is missing");
    return null;
  }

  let filepath = null;

  try {
    logger.info("[Image] Downloading image from Meta");

    const metaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${id}`;
    const metaResponse = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const mediaUrl = metaResponse.data?.url;
    const mimeType = metaResponse.data?.mime_type || "image/jpeg";

    if (!mediaUrl) {
      logger.error("[Image] Meta did not return media URL");
      return null;
    }

    const fileResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
    });

    ensureTempDir();
    const ext = extFromMime(mimeType);
    filepath = path.join(TEMP_DIR, `wa-image-${id}-${randomUUID()}${ext}`);

    await fs.promises.writeFile(filepath, Buffer.from(fileResponse.data));

    logger.info("[Image] Image downloaded:", filepath);
    return { filepath, mimeType };
  } catch (error) {
    logger.error(
      "[Image] downloadWhatsAppImage error:",
      error.response?.data || error.message
    );
    if (filepath) await safeUnlink(filepath);
    return null;
  }
};

const VISION_SYSTEM_PROMPT = `Eres el asistente veterinario de Mateos Pet, veterinaria y peluquería canina en Colombia.
Analiza la imagen que te envía el cliente y describe lo que observas en términos de salud animal.
Si ves una mascota: describe su apariencia visible, condición del pelaje o piel, lesiones, postura u otras observaciones relevantes para su historial médico.
Si ves un medicamento, producto veterinario o examen: describe lo que muestra.
Responde en español, de forma clara y concisa (máximo 4 líneas).
No hagas diagnósticos definitivos. Usa frases como "se observa", "parece", "podría indicar".`;

/**
 * Analiza una imagen local con GPT-4o vision.
 * @param {string} filepath
 * @param {string} mimeType
 * @returns {Promise<string|null>}
 */
const analyzeImageWithVision = async (filepath, mimeType) => {
  if (!filepath || !fs.existsSync(filepath)) {
    logger.error("[Image] File not found for vision analysis");
    return null;
  }

  try {
    logger.info("[Image] Analyzing image with GPT-4o vision");

    const imageBuffer = await fs.promises.readFile(filepath);
    const base64 = imageBuffer.toString("base64");
    const mediaType = mimeType || "image/jpeg";

    const response = await getClient().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType};base64,${base64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    });

    const analysis = response.choices?.[0]?.message?.content?.trim();

    if (!analysis) {
      logger.warn("[Image] Empty vision response");
      return null;
    }

    logger.info("[Image] Vision analysis completed");
    return analysis;
  } catch (error) {
    logger.error("[Image] analyzeImageWithVision error:", error.message);
    return null;
  }
};

/**
 * Descarga, analiza y limpia el archivo temporal de la imagen.
 * @param {string} mediaId
 * @returns {Promise<string|null>} Análisis en texto o null si falla
 */
const processImageMessage = async (mediaId) => {
  let filepath = null;

  try {
    const downloaded = await downloadWhatsAppImage(mediaId);

    if (!downloaded) return null;

    filepath = downloaded.filepath;

    const analysis = await analyzeImageWithVision(
      downloaded.filepath,
      downloaded.mimeType
    );

    return analysis;
  } catch (error) {
    logger.error("[Image] processImageMessage error:", error.message);
    return null;
  } finally {
    if (filepath) await safeUnlink(filepath);
  }
};

module.exports = { processImageMessage };
