/**
 * Mejora post-Fase 8 (2026-09-08): una conversación con
 * `Conversation.status === "esperando_humano"` no silenciaba al bot —
 * `session.step === HUMAN_TAKEOVER` nunca se leía para bloquear nada (solo
 * alimentaba auditoría en el caso de uso de Recepcionista IA), así que Lina
 * seguía respondiendo en paralelo a un cliente que ya estaba hablando con un
 * humano. Este test cubre el guard agregado en whatsapp.service.js: mensaje
 * persistido (visible para el humano en el dashboard), sin respuesta
 * automática ni gasto de IA.
 */
jest.mock("../../services/openai.service", () => ({ analyzeMessage: jest.fn() }));
jest.mock("../../lib/logger", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock("../../services/conversation.service", () => ({
  generateReply: jest.fn(),
  getConfirmationReply: jest.fn(),
  isConfirmationMessage: jest.fn(),
  STEPS: { AWAITING_CONFIRMATION: "awaiting_confirmation", HUMAN_TAKEOVER: "human_takeover" },
}));
jest.mock("../../services/memory.service", () => ({ getSession: jest.fn(), updateSession: jest.fn() }));
jest.mock("../../services/scheduling.service", () => ({
  detectHumanEscalation: jest.fn(() => false),
  formatRelativeDayLabel: jest.fn(),
  formatHourAmPm: jest.fn(),
}));
jest.mock("../../services/user.service", () => ({
  findOrCreateUser: jest.fn(),
  updateUserNameIfMissing: jest.fn(),
}));
jest.mock("../../services/pet.service", () => ({
  findOrCreatePet: jest.fn(),
  findPetByNameAndOwner: jest.fn(),
  resolveAppointmentPetName: jest.fn(),
}));
jest.mock("../../services/appointment.service", () => ({
  buildAppointmentDateTime: jest.fn(),
  mapSessionServiceType: jest.fn(),
  createAppointment: jest.fn(),
  checkAppointmentConflict: jest.fn(),
}));
jest.mock("../../lib/timezone", () => ({ formatSlotForUser: jest.fn() }));
jest.mock("../../services/conversation-persistence.service", () => ({
  findOrCreateConversation: jest.fn(),
  saveMessage: jest.fn(),
  findMessageByExternalId: jest.fn(),
  getConversationMessages: jest.fn(),
  syncConversationState: jest.fn(),
}));
jest.mock("../../services/context-builder.service", () => ({ buildConversationHistory: jest.fn(() => []) }));
jest.mock("../../services/semantic-memory.service", () => ({
  searchRelevantMemories: jest.fn(),
  buildSemanticContext: jest.fn(() => ""),
}));
jest.mock("../../services/business-knowledge.service", () => ({
  searchRelevantKnowledge: jest.fn(),
  buildKnowledgeContext: jest.fn(() => ""),
}));
jest.mock("../../services/audio.service", () => ({ processVoiceMessage: jest.fn() }));
jest.mock("../../services/image.service", () => ({ processImageMessage: jest.fn() }));
jest.mock("../../services/medical-record.service", () => ({ createRecord: jest.fn() }));
jest.mock("../../services/tenant.service", () => ({ getTenantByPhone: jest.fn() }));
// phone-lock.service NO se mockea — mutex real en memoria, sin dependencias externas.

const { analyzeMessage } = require("../../services/openai.service");
const { generateReply } = require("../../services/conversation.service");
const { getSession, updateSession } = require("../../services/memory.service");
const { findOrCreateUser } = require("../../services/user.service");
const {
  findOrCreateConversation,
  saveMessage,
  findMessageByExternalId,
} = require("../../services/conversation-persistence.service");
const { getTenantByPhone } = require("../../services/tenant.service");
const { processIncomingMessage } = require("../../services/whatsapp.service");

const PHONE = "573000000000";

function buildBody(text, wamid = "wamid-1") {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "pn-1" },
              messages: [{ from: PHONE, id: wamid, type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  findMessageByExternalId.mockResolvedValue(null);
  getTenantByPhone.mockResolvedValue({ id: "tenant-1", slug: "t1", active: true });
  findOrCreateUser.mockResolvedValue({ id: "user-1", phone: PHONE, tenantId: "tenant-1" });
  saveMessage.mockResolvedValue({ id: "msg-1" });
});

describe("processIncomingMessage — silencio tras escalar a humano", () => {
  test("Conversation.status === 'esperando_humano': persiste el mensaje, no responde, no gasta IA", async () => {
    findOrCreateConversation.mockResolvedValue({ id: "conv-1", status: "esperando_humano" });

    const result = await processIncomingMessage(buildBody("¿cuánto cuesta el baño?"));

    expect(saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv-1", role: "user" })
    );
    expect(result.reply).toBeFalsy();
    expect(result.conversation).toEqual({ id: "conv-1", status: "esperando_humano" });
    expect(analyzeMessage).not.toHaveBeenCalled();
    expect(generateReply).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  test("Conversation.status !== 'esperando_humano': el guard no bloquea, el pipeline sigue normal", async () => {
    findOrCreateConversation.mockResolvedValue({ id: "conv-2", status: "activa" });
    getSession.mockReturnValue({});
    analyzeMessage.mockResolvedValue({ intent: "ask_info" });
    generateReply.mockResolvedValue({ reply: "Con gusto te cuento 😊", step: null, sessionPatch: {} });
    updateSession.mockReturnValue({ step: null });

    const result = await processIncomingMessage(buildBody("hola"));

    expect(analyzeMessage).toHaveBeenCalled();
    expect(result.reply).toBe("Con gusto te cuento 😊");
  });
});
