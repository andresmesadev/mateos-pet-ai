const { createSendMessageUseCase } = require("../../contexts/communication/application/use-cases/send-message.usecase");
const build = () => {
  const provider = { send: jest.fn().mockResolvedValue({ messageId: "wamid.out" }) };
  const messages = { create: jest.fn(async data => ({ id: "local", ...data })) };
  const events = { publish: jest.fn() };
  const execute = createSendMessageUseCase({ channelRepository: { findActiveDefault: async () => ({ type: "whatsapp" }) },
    conversationRepository: { findById: async () => ({ id: "c" }) }, messageRepository: messages, channelProvider: provider, eventPublisher: events });
  return { execute, provider, messages, events };
};
const command = { tenantId: "t", userId: "u", phone: "555", conversationId: "c", content: "hello", origin: "agente" };
test("outbound provider ID is persisted for later delivery receipts", async () => {
  const { execute, messages } = build(); await execute(command);
  expect(messages.create).toHaveBeenCalledWith(expect.objectContaining({ externalId: "wamid.out" }));
});
test("failure after provider acceptance is explicitly unsafe to resend", async () => {
  const { execute, messages, provider } = build(); messages.create.mockRejectedValue(new Error("db offline"));
  await expect(execute(command)).rejects.toMatchObject({ deliveryAccepted: true, providerMessageId: "wamid.out" });
  expect(provider.send).toHaveBeenCalledTimes(1);
});
test("event publication failure also cannot trigger a duplicate external send", async () => {
  const { execute, events, provider } = build(); events.publish.mockRejectedValue(new Error("event failure"));
  await expect(execute(command)).rejects.toMatchObject({ deliveryAccepted: true });
  expect(provider.send).toHaveBeenCalledTimes(1);
});
