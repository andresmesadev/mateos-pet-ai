const { createWhatsAppWindowGuard } = require("../infrastructure/providers/whatsapp-window-guard");
const { createSendMessageUseCase } = require("../application/use-cases/send-message.usecase");
const clock = new Date("2026-10-13T16:00:00Z");
const input = { tenantId: "tenant-a", userId: "owner-a", phone: "test", origin: "sistema", channelType: "whatsapp", purpose: "reminder" };

test.each([40, 24, 24 - 1 / 60, -1])("window closed at %s hours: no provider invocation", async hours => {
  const repository = { findLatestIncomingAt: jest.fn().mockResolvedValue(new Date(clock - hours * 3600000)) };
  const deliver = jest.fn();
  const result = await createWhatsAppWindowGuard({ messageRepository: repository, now: () => clock })(input, deliver);
  expect(result).toMatchObject({ skipped: true, message: null, reason: "whatsapp_window_closed" });
  expect(repository.findLatestIncomingAt).toHaveBeenCalledWith("owner-a", "tenant-a");
  expect(deliver).not.toHaveBeenCalled();
});

test.each([null, "invalid date"])("missing/invalid interaction %s never starts a text notification", async timestamp => {
  const deliver = jest.fn();
  const result = await createWhatsAppWindowGuard({ messageRepository: { findLatestIncomingAt: async () => timestamp }, now: () => clock })(input, deliver);
  expect(result.skipped).toBe(true);
  expect(deliver).not.toHaveBeenCalled();
});

test("recent owner interaction allows notification", async () => {
  const deliver = jest.fn().mockResolvedValue({ message: { id: "accepted" } });
  const result = await createWhatsAppWindowGuard({ messageRepository: { findLatestIncomingAt: async () => new Date(clock - 23 * 3600000) }, now: () => clock })(input, deliver);
  expect(result.message.id).toBe("accepted");
  expect(deliver).toHaveBeenCalledTimes(1);
});

test("repository failure does not fall back to an unverified send", async () => {
  const deliver = jest.fn();
  const guard = createWhatsAppWindowGuard({ messageRepository: { findLatestIncomingAt: async () => { throw Error("database unavailable"); } } });
  await expect(guard(input, deliver)).rejects.toThrow("database unavailable");
  expect(deliver).not.toHaveBeenCalled();
});

test("system notification without tenant is omitted without reading another customer's history", async () => {
  const repository = { findLatestIncomingAt: jest.fn() }, deliver = jest.fn();
  const result = await createWhatsAppWindowGuard({ messageRepository: repository })({ ...input, tenantId: null }, deliver);
  expect(result.reason).toBe("whatsapp_window_unverified");
  expect(repository.findLatestIncomingAt).not.toHaveBeenCalled();
  expect(deliver).not.toHaveBeenCalled();
});

test.each([{ origin: "agente" }, { channelType: "email" }, { purpose: null }])("other sending contracts including OTP are preserved: %j", async patch => {
  const repository = { findLatestIncomingAt: jest.fn() }, deliver = jest.fn().mockResolvedValue("existing path");
  expect(await createWhatsAppWindowGuard({ messageRepository: repository })({ ...input, ...patch }, deliver)).toBe("existing path");
  expect(repository.findLatestIncomingAt).not.toHaveBeenCalled();
});

test("real send use case: expired notification creates no message/event and never contacts provider", async () => {
  const messageRepository = { create: jest.fn(), findLatestIncomingAt: jest.fn().mockResolvedValue(new Date(clock - 40 * 3600000)) };
  const channelProvider = { send: jest.fn() }, eventPublisher = { publish: jest.fn() };
  const send = createSendMessageUseCase({
    channelRepository: { findActiveDefault: async () => ({ id: "channel", type: "whatsapp" }) },
    conversationRepository: { findOrCreateActiveForUser: async () => ({ id: "new-thread" }) },
    messageRepository, channelProvider, eventPublisher,
    deliveryGuard: createWhatsAppWindowGuard({ messageRepository, now: () => clock }),
  });
  expect(await send({ ...input, content: "Reminder" })).toMatchObject({ skipped: true });
  expect(channelProvider.send).not.toHaveBeenCalled();
  expect(messageRepository.create).not.toHaveBeenCalled();
  expect(eventPublisher.publish).not.toHaveBeenCalled();
});
