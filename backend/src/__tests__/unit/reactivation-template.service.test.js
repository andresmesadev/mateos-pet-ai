/**
 * Mejora post-Fase 8 (2026-09-08) — plantilla de reactivación config-driven
 * (WHATSAPP_TEMPLATE_REACTIVACION_NAME/_LANG). Mientras esas variables no
 * estén configuradas (plantilla aún en aprobación en Meta), debe fallar
 * cerrado sin intentar enviar nada.
 */
jest.mock("../../contexts/communication", () => ({ sendTemplateMessage: jest.fn() }));

const { sendTemplateMessage } = require("../../contexts/communication");
const {
  isReactivationTemplateConfigured,
  sendReactivationTemplate,
} = require("../../services/reactivation-template.service");

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME;
  delete process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("isReactivationTemplateConfigured", () => {
  test("false sin las dos variables de entorno", () => {
    expect(isReactivationTemplateConfigured()).toBe(false);
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME = "reactivacion_cliente";
    expect(isReactivationTemplateConfigured()).toBe(false); // falta _LANG
  });

  test("true con ambas configuradas", () => {
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME = "reactivacion_cliente";
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG = "es";
    expect(isReactivationTemplateConfigured()).toBe(true);
  });
});

describe("sendReactivationTemplate", () => {
  test("sin configurar, falla cerrado — no intenta enviar nada", async () => {
    const sent = await sendReactivationTemplate({ userId: "user-1", phone: "573000000000", clientName: "María" });
    expect(sent).toBe(false);
    expect(sendTemplateMessage).not.toHaveBeenCalled();
  });

  test("configurada: arma components con el nombre del cliente y envía", async () => {
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME = "reactivacion_cliente";
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG = "es";
    sendTemplateMessage.mockResolvedValue({ message: {} });

    const sent = await sendReactivationTemplate({
      tenantId: "tenant-1",
      userId: "user-1",
      phone: "573000000000",
      clientName: "María",
    });

    expect(sent).toBe(true);
    expect(sendTemplateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        phone: "573000000000",
        templateName: "reactivacion_cliente",
        languageCode: "es",
        components: [{ type: "body", parameters: [{ type: "text", text: "María" }] }],
      })
    );
  });

  test("sin nombre de cliente, usa 'cliente' como fallback (sin romper la plantilla)", async () => {
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME = "reactivacion_cliente";
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG = "es";
    sendTemplateMessage.mockResolvedValue({ message: {} });

    await sendReactivationTemplate({ userId: "user-1", phone: "573000000000" });

    expect(sendTemplateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [{ type: "body", parameters: [{ type: "text", text: "cliente" }] }],
      })
    );
  });

  test("si sendTemplateMessage falla, retorna false sin lanzar", async () => {
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME = "reactivacion_cliente";
    process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG = "es";
    sendTemplateMessage.mockRejectedValue(new Error("plantilla rechazada"));

    const sent = await sendReactivationTemplate({ userId: "user-1", phone: "573000000000", clientName: "María" });
    expect(sent).toBe(false);
  });
});
