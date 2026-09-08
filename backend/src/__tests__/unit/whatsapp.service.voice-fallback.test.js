/**
 * Mejora post-Fase 8 (2026-09-08): antes, si Whisper no lograba transcribir
 * una nota de voz, el cliente no recibía ninguna respuesta — la función
 * retornaba `processed: false` antes de resolver user/conversation, sin
 * enviar nada. Ahora sigue el flujo normal y responde con un mensaje de
 * respaldo, igual que ya hacía la rama de imagen fallida.
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

const { processVoiceMessage } = require("../../services/audio.service");
const { analyzeMessage } = require("../../services/openai.service");
const { findOrCreateUser } = require("../../services/user.service");
const {
  findOrCreateConversation,
  saveMessage,
  findMessageByExternalId,
} = require("../../services/conversation-persistence.service");
const { getTenantByPhone } = require("../../services/tenant.service");
const { processIncomingMessage } = require("../../services/whatsapp.service");

const PHONE = "573000000000";

function buildAudioBody(wamid = "wamid-audio-1") {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "pn-1" },
              messages: [
                { from: PHONE, id: wamid, type: "audio", audio: { id: "media-1", mime_type: "audio/ogg" } },
              ],
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

describe("processIncomingMessage — respaldo cuando falla la transcripción de voz", () => {
  test("Whisper no transcribe: responde con mensaje de respaldo, no deja al cliente sin nada", async () => {
    findOrCreateConversation.mockResolvedValue({ id: "conv-1", status: "activa" });
    processVoiceMessage.mockResolvedValue(null);

    const result = await processIncomingMessage(buildAudioBody());

    expect(result.processed).toBe(true);
    expect(result.reply).toContain("No logré entender tu nota de voz");
    expect(analyzeMessage).not.toHaveBeenCalled();
  });

  test("conversación ya escalada a humano: ni siquiera el respaldo se envía (se mantiene el silencio)", async () => {
    findOrCreateConversation.mockResolvedValue({ id: "conv-1", status: "esperando_humano" });
    processVoiceMessage.mockResolvedValue(null);

    const result = await processIncomingMessage(buildAudioBody());

    expect(result.reply).toBeFalsy();
  });

  test("transcripción exitosa: sigue el flujo normal de texto (sin el mensaje de respaldo)", async () => {
    findOrCreateConversation.mockResolvedValue({ id: "conv-1", status: "activa" });
    processVoiceMessage.mockResolvedValue("hola quiero una cita");
    analyzeMessage.mockResolvedValue({ intent: "schedule_appointment" });
    require("../../services/memory.service").getSession.mockReturnValue({});
    require("../../services/memory.service").updateSession.mockReturnValue({ step: null });
    require("../../services/conversation.service").generateReply.mockResolvedValue({
      reply: "¿Es para veterinaria o grooming?",
      step: null,
      sessionPatch: {},
    });

    const result = await processIncomingMessage(buildAudioBody());

    expect(result.reply).not.toContain("No logré entender");
    expect(analyzeMessage).toHaveBeenCalled();
  });
});
