jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from("fake-image-bytes")),
  },
}));

jest.mock("axios", () => ({ get: jest.fn() }));

jest.mock("openai", () => {
  const mockChatCreate = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
  }));
  ctor.__mockChatCreate = mockChatCreate;
  return ctor;
});

const fs = require("fs");
const axios = require("axios");
const OpenAI = require("openai");
const mockChatCreate = OpenAI.__mockChatCreate;
const { processImageMessage } = require("../image.service");

const ORIGINAL_ENV = { ...process.env };

const mockDownloadSuccess = (mimeType = "image/jpeg") => {
  axios.get
    .mockResolvedValueOnce({ data: { url: "https://media.example/f", mime_type: mimeType } })
    .mockResolvedValueOnce({ data: Buffer.from("image-bytes") });
};

const generatedFilepath = () => fs.promises.writeFile.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
  fs.existsSync.mockReturnValue(true);
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("processImageMessage — descarga", () => {
  test("retorna null sin llamar a axios si mediaId está vacío", async () => {
    await expect(processImageMessage("")).resolves.toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("retorna null si falta WHATSAPP_ACCESS_TOKEN", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(processImageMessage("media-1")).resolves.toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("retorna null si Meta no retorna una url de media", async () => {
    axios.get.mockResolvedValueOnce({ data: {} });
    await expect(processImageMessage("media-1")).resolves.toBeNull();
  });

  test.each([
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/jpeg", ".jpg"],
    [undefined, ".jpg"],
  ])("mapea mime %s a la extensión %s", async (mime, ext) => {
    mockDownloadSuccess(mime);
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "análisis" } }] });
    await processImageMessage("media-1");
    expect(generatedFilepath().endsWith(ext)).toBe(true);
  });

  test("crea el directorio temporal si no existe", async () => {
    fs.existsSync.mockReturnValueOnce(false).mockReturnValue(true);
    mockDownloadSuccess();
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "análisis" } }] });
    await processImageMessage("media-1");
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  test("retorna null si falla la consulta de metadata a Meta", async () => {
    axios.get.mockRejectedValueOnce(new Error("meta down"));
    await expect(processImageMessage("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  test("usa error.response.data como detalle si está disponible", async () => {
    const error = new Error("meta down");
    error.response = { data: { error: "bad request" } };
    axios.get.mockRejectedValueOnce(error);
    await expect(processImageMessage("media-1")).resolves.toBeNull();
  });

  test("limpia el archivo temporal si falla la escritura a disco", async () => {
    mockDownloadSuccess();
    fs.promises.writeFile.mockRejectedValueOnce(new Error("disk full"));
    await expect(processImageMessage("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringContaining("wa-image-media-1-"));
  });
});

describe("processImageMessage — análisis con Vision", () => {
  test("analiza la imagen y retorna el texto, limpiando el archivo temporal", async () => {
    mockDownloadSuccess();
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "  se observa una mascota sana  " } }],
    });

    await expect(processImageMessage("media-1")).resolves.toBe("se observa una mascota sana");
    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o", max_tokens: 300 })
    );
    expect(fs.promises.unlink).toHaveBeenCalledWith(generatedFilepath());
  });

  test("retorna null si la respuesta de Vision viene vacía", async () => {
    mockDownloadSuccess();
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "   " } }] });
    await expect(processImageMessage("media-1")).resolves.toBeNull();
  });

  test("retorna null si la respuesta no trae choices", async () => {
    mockDownloadSuccess();
    mockChatCreate.mockResolvedValue({});
    await expect(processImageMessage("media-1")).resolves.toBeNull();
  });

  test("retorna null (sin lanzar) si Vision falla", async () => {
    mockDownloadSuccess();
    mockChatCreate.mockRejectedValue(new Error("openai down"));
    await expect(processImageMessage("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).toHaveBeenCalled();
  });

  test("retorna null si el archivo ya no existe al momento de analizarlo", async () => {
    mockDownloadSuccess();
    fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await expect(processImageMessage("media-1")).resolves.toBeNull();
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  test("ignora silenciosamente un fallo de borrado con ENOENT", async () => {
    mockDownloadSuccess();
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "análisis" } }] });
    const enoent = new Error("no existe");
    enoent.code = "ENOENT";
    fs.promises.unlink.mockRejectedValueOnce(enoent);
    await expect(processImageMessage("media-1")).resolves.toBe("análisis");
  });

  test("advierte pero no falla si el borrado falla con otro código", async () => {
    mockDownloadSuccess();
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: "análisis" } }] });
    const eperm = new Error("permiso denegado");
    eperm.code = "EPERM";
    fs.promises.unlink.mockRejectedValueOnce(eperm);
    await expect(processImageMessage("media-1")).resolves.toBe("análisis");
  });

  test("retorna null si algo lanza fuera de las capturas internas", async () => {
    mockDownloadSuccess();
    fs.existsSync
      .mockReturnValueOnce(true) // ensureTempDir: el directorio ya existe
      .mockImplementationOnce(() => {
        throw new Error("fs boom");
      });
    await expect(processImageMessage("media-1")).resolves.toBeNull();
    expect(fs.promises.unlink).toHaveBeenCalled();
  });
});
