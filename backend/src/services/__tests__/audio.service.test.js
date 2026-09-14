jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createReadStream: jest.fn(() => "fake-stream"),
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("axios", () => ({ get: jest.fn() }));

jest.mock("openai", () => {
  const mockTranscriptionsCreate = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: mockTranscriptionsCreate } },
  }));
  ctor.__mockTranscriptionsCreate = mockTranscriptionsCreate;
  return ctor;
});

const fs = require("fs");
const axios = require("axios");
const OpenAI = require("openai");
const mockTranscriptionsCreate = OpenAI.__mockTranscriptionsCreate;
const {
  downloadWhatsAppAudio,
  transcribeAudio,
  processVoiceMessage,
} = require("../audio.service");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
  fs.existsSync.mockReturnValue(true);
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("downloadWhatsAppAudio", () => {
  test("retorna null sin llamar a axios si mediaId está vacío", async () => {
    await expect(downloadWhatsAppAudio("")).resolves.toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("retorna null si falta WHATSAPP_ACCESS_TOKEN", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(downloadWhatsAppAudio("media-1")).resolves.toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("retorna null si Meta no retorna una url de media", async () => {
    axios.get.mockResolvedValueOnce({ data: {} });
    await expect(downloadWhatsAppAudio("media-1")).resolves.toBeNull();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test("descarga y guarda el archivo, creando el directorio temporal si no existe", async () => {
    fs.existsSync.mockReturnValue(false);
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/mpeg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });

    const filepath = await downloadWhatsAppAudio("media-1");

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(filepath).toEqual(expect.stringContaining("wa-audio-media-1-"));
    expect(filepath.endsWith(".mp3")).toBe(true);
    expect(fs.promises.writeFile).toHaveBeenCalledWith(filepath, expect.any(Buffer));
  });

  test("usa .ogg si no viene mime_type", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    const filepath = await downloadWhatsAppAudio("media-1");
    expect(filepath.endsWith(".ogg")).toBe(true);
  });

  test("no crea el directorio temporal si ya existe", async () => {
    fs.existsSync.mockReturnValue(true);
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/ogg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    await downloadWhatsAppAudio("media-1");
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  test.each([
    ["audio/mp4", ".m4a"],
    ["audio/wav", ".wav"],
    ["audio/webm", ".webm"],
    ["audio/unknown-format", ".ogg"],
  ])("mapea mime %s a la extensión %s", async (mime, ext) => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: mime } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    const filepath = await downloadWhatsAppAudio("media-1");
    expect(filepath.endsWith(ext)).toBe(true);
  });

  test("retorna null si falla la consulta de metadata a Meta (sin filepath que limpiar)", async () => {
    axios.get.mockRejectedValueOnce(new Error("meta down"));
    await expect(downloadWhatsAppAudio("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  test("usa error.response.data como detalle si está disponible", async () => {
    const error = new Error("meta down");
    error.response = { data: { error: "bad request" } };
    axios.get.mockRejectedValueOnce(error);
    await expect(downloadWhatsAppAudio("media-1")).resolves.toBeNull();
  });

  test("limpia el archivo temporal si falla la escritura a disco", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/mpeg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    fs.promises.writeFile.mockRejectedValueOnce(new Error("disk full"));

    await expect(downloadWhatsAppAudio("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringContaining("wa-audio-media-1-"));
  });
});

describe("transcribeAudio", () => {
  test("retorna null si filepath está vacío", async () => {
    await expect(transcribeAudio("")).resolves.toBeNull();
    expect(mockTranscriptionsCreate).not.toHaveBeenCalled();
  });

  test("retorna null si el archivo no existe", async () => {
    fs.existsSync.mockReturnValue(false);
    await expect(transcribeAudio("/tmp/x.ogg")).resolves.toBeNull();
    expect(mockTranscriptionsCreate).not.toHaveBeenCalled();
  });

  test("transcribe y retorna el texto normalizado (respuesta como objeto)", async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: "  hola mundo  " });
    await expect(transcribeAudio("/tmp/x.ogg")).resolves.toBe("hola mundo");
    expect(mockTranscriptionsCreate).toHaveBeenCalledWith({
      file: "fake-stream",
      model: "whisper-1",
    });
  });

  test("transcribe y retorna el texto normalizado (respuesta como string plano)", async () => {
    mockTranscriptionsCreate.mockResolvedValue("  hola string  ");
    await expect(transcribeAudio("/tmp/x.ogg")).resolves.toBe("hola string");
  });

  test("retorna null si la transcripción viene vacía", async () => {
    mockTranscriptionsCreate.mockResolvedValue({ text: "   " });
    await expect(transcribeAudio("/tmp/x.ogg")).resolves.toBeNull();
  });

  test("retorna null si la respuesta no trae campo text", async () => {
    mockTranscriptionsCreate.mockResolvedValue({});
    await expect(transcribeAudio("/tmp/x.ogg")).resolves.toBeNull();
  });

  test("retorna null (sin lanzar) si Whisper falla", async () => {
    mockTranscriptionsCreate.mockRejectedValue(new Error("whisper down"));
    await expect(transcribeAudio("/tmp/x.ogg")).resolves.toBeNull();
  });
});

describe("processVoiceMessage", () => {
  test("retorna null si la descarga falla, sin intentar transcribir", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(processVoiceMessage("media-1")).resolves.toBeNull();
    expect(mockTranscriptionsCreate).not.toHaveBeenCalled();
    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  test("descarga, transcribe y limpia el archivo temporal en éxito", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/ogg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    mockTranscriptionsCreate.mockResolvedValue({ text: "hola" });

    await expect(processVoiceMessage("media-1")).resolves.toBe("hola");
    expect(fs.promises.unlink).toHaveBeenCalledWith(
      expect.stringContaining("wa-audio-media-1-")
    );
  });

  test("limpia el archivo temporal aunque la transcripción falle", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/ogg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    mockTranscriptionsCreate.mockRejectedValue(new Error("whisper down"));

    await expect(processVoiceMessage("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).toHaveBeenCalled();
  });

  test("retorna null si algo lanza fuera de las capturas internas", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/ogg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    fs.existsSync
      .mockReturnValueOnce(true) // ensureTempDir: el directorio ya existe
      .mockImplementationOnce(() => {
        throw new Error("fs boom");
      });

    await expect(processVoiceMessage("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).toHaveBeenCalled();
  });

  test("ignora silenciosamente un fallo de borrado con ENOENT", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/ogg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    mockTranscriptionsCreate.mockResolvedValue({ text: "hola" });
    const enoent = new Error("no existe");
    enoent.code = "ENOENT";
    fs.promises.unlink.mockRejectedValueOnce(enoent);

    await expect(processVoiceMessage("media-1")).resolves.toBe("hola");
  });

  test("advierte pero no falla si el borrado falla con otro código", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: "audio/ogg" } })
      .mockResolvedValueOnce({ data: Buffer.from("audio-bytes") });
    mockTranscriptionsCreate.mockResolvedValue({ text: "hola" });
    const eperm = new Error("permiso denegado");
    eperm.code = "EPERM";
    fs.promises.unlink.mockRejectedValueOnce(eperm);

    await expect(processVoiceMessage("media-1")).resolves.toBe("hola");
  });
});
