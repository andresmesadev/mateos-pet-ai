/**
 * Mejora post-Fase 8 (2026-09-08) — sendWhatsAppTemplateMessage.
 */
jest.mock("axios");
const axios = require("axios");
const { sendWhatsAppTemplateMessage } = require("../../services/whatsapp-api.service");

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, WHATSAPP_PHONE_NUMBER_ID: "pn-1", WHATSAPP_ACCESS_TOKEN: "token-1" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("sendWhatsAppTemplateMessage", () => {
  test("sin credenciales configuradas, no llama a axios y retorna null", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "";
    const result = await sendWhatsAppTemplateMessage("573000000000", "reactivacion_cliente", "es", []);
    expect(result).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("sin templateName/languageCode, no llama a axios y retorna null", async () => {
    const result = await sendWhatsAppTemplateMessage("573000000000", "", "es", []);
    expect(result).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("payload correcto: type=template, name/language/components tal cual se pasaron", async () => {
    axios.post.mockResolvedValue({ data: { messaging_product: "whatsapp", messages: [{ id: "wamid.1" }] } });

    const components = [{ type: "body", parameters: [{ type: "text", text: "María" }] }];
    const result = await sendWhatsAppTemplateMessage("573000000000", "reactivacion_cliente", "es", components);

    expect(result).toEqual({ messaging_product: "whatsapp", messages: [{ id: "wamid.1" }] });
    const [url, payload] = axios.post.mock.calls[0];
    expect(url).toContain("pn-1/messages");
    expect(payload).toMatchObject({
      messaging_product: "whatsapp",
      to: "573000000000",
      type: "template",
      template: { name: "reactivacion_cliente", language: { code: "es" }, components },
    });
  });

  test("plantilla sin components: no incluye la clave components en el payload", async () => {
    axios.post.mockResolvedValue({ data: {} });
    await sendWhatsAppTemplateMessage("573000000000", "plantilla_simple", "es", []);
    const [, payload] = axios.post.mock.calls[0];
    expect(payload.template).not.toHaveProperty("components");
  });

  test("si Meta responde error, retorna null sin lanzar", async () => {
    axios.post.mockRejectedValue({ response: { data: { error: { message: "Template not found" } }, status: 400 } });
    const result = await sendWhatsAppTemplateMessage("573000000000", "no_existe", "es", []);
    expect(result).toBeNull();
  });
});
