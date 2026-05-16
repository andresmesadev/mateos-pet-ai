const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const OpenAI = require("openai");
const axios = require("axios");

const GRAPH_API_VERSION = "v25.0";
const WHISPER_MODEL = "whisper-1";

const TEMP_DIR = path.join(__dirname, "../../uploads/temp");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getAccessToken = () =>
  String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();

const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
};

const extensionFromMime = (mimeType) => {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  if (mime.includes("mp4") || mime.includes("m4a")) return ".m4a";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("webm")) return ".webm";
  return ".ogg";
};

const safeUnlink = async (filepath) => {
  if (!filepath) return;
  try {
    await fs.promises.unlink(filepath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("[Audio] Could not delete temp file:", error.message);
    }
  }
};

/**
 * Obtiene URL de media en Meta y descarga el archivo a uploads/temp.
 * @param {string} mediaId
 * @returns {Promise<string|null>} Ruta local del archivo
 */
const downloadWhatsAppAudio = async (mediaId) => {
  const id = String(mediaId || "").trim();
  const accessToken = getAccessToken();

  if (!id) {
    console.error("[Audio] mediaId is required");
    return null;
  }

  if (!accessToken) {
    console.error("[Audio] WHATSAPP_ACCESS_TOKEN is missing");
    return null;
  }

  let filepath = null;

  try {
    console.log("[Audio] Downloading audio");

    const metaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${id}`;
    const metaResponse = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const mediaUrl = metaResponse.data?.url;
    const mimeType = metaResponse.data?.mime_type;

    if (!mediaUrl) {
      console.error("[Audio] Meta did not return media URL");
      return null;
    }

    const fileResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
    });

    ensureTempDir();
    const ext = extensionFromMime(mimeType);
    filepath = path.join(TEMP_DIR, `wa-audio-${id}-${randomUUID()}${ext}`);

    await fs.promises.writeFile(filepath, Buffer.from(fileResponse.data));

    console.log("[Audio] Audio downloaded:", filepath);
    return filepath;
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error("[Audio] downloadWhatsAppAudio error:", detail);
    if (filepath) {
      await safeUnlink(filepath);
    }
    return null;
  }
};

/**
 * Transcribe archivo local con Whisper.
 * @param {string} filepath
 * @returns {Promise<string|null>}
 */
const transcribeAudio = async (filepath) => {
  const filePath = String(filepath || "").trim();

  if (!filePath || !fs.existsSync(filePath)) {
    console.error("[Audio] File not found for transcription");
    return null;
  }

  try {
    console.log("[Audio] Transcribing audio");

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: WHISPER_MODEL,
    });

    const text =
      typeof transcription === "string"
        ? transcription
        : transcription?.text;

    const normalized = String(text || "").trim();

    if (!normalized) {
      console.warn("[Audio] Empty transcription result");
      return null;
    }

    console.log("[Audio] Transcription completed");
    return normalized;
  } catch (error) {
    console.error("[Audio] transcribeAudio error:", error.message);
    return null;
  }
};

/**
 * Descarga, transcribe y limpia archivo temporal.
 * @param {string} mediaId
 * @returns {Promise<string|null>}
 */
const processVoiceMessage = async (mediaId) => {
  let filepath = null;

  try {
    filepath = await downloadWhatsAppAudio(mediaId);

    if (!filepath) {
      return null;
    }

    const text = await transcribeAudio(filepath);
    return text;
  } catch (error) {
    console.error("[Audio] processVoiceMessage error:", error.message);
    return null;
  } finally {
    if (filepath) {
      await safeUnlink(filepath);
    }
  }
};

module.exports = {
  downloadWhatsAppAudio,
  transcribeAudio,
  processVoiceMessage,
  TEMP_DIR,
};
