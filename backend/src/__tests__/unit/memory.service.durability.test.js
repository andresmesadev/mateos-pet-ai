jest.mock("../../lib/prisma", () => ({ conversation: { update: jest.fn() } }));
const prisma = require("../../lib/prisma");
const memory = require("../../services/memory.service");
const conv = (id, tenantId, pet) => ({ id, tenantId, userId: "owner", step: "awaiting_pet_type", intent: "schedule_appointment", sessionData: { pet_name: pet } });
beforeEach(() => { jest.clearAllMocks(); prisma.conversation.update.mockResolvedValue({}); });
test("same phone has independent drafts per establishment", () => {
  memory.hydrateSessionFromConversation("555", conv("c1", "t1", "Akiles"));
  memory.hydrateSessionFromConversation("555", conv("c2", "t2", "Matías"));
  expect(memory.getSession("555", "t1").pet_name).toBe("Akiles");
  expect(memory.getSession("555", "t2").pet_name).toBe("Matías");
});
test("new conversation replaces cached pet", () => {
  memory.hydrateSessionFromConversation("556", conv("old", "t1", "Akiles"));
  memory.hydrateSessionFromConversation("556", conv("new", "t1", "Matías"));
  expect(memory.getSession("556", "t1").pet_name).toBe("Matías");
});
test("second snapshot cannot complete before first snapshot", async () => {
  let finishFirst;
  prisma.conversation.update.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; })).mockResolvedValue({});
  memory.hydrateSessionFromConversation("557", conv("ordered", "t1", "Akiles"));
  memory.updateSession("557", { pet_name: "Luna" }, "t1");
  memory.updateSession("557", { pet_name: "Matías" }, "t1");
  await new Promise(resolve => setImmediate(resolve));
  expect(prisma.conversation.update).toHaveBeenCalledTimes(1);
  finishFirst({}); await memory.flushConversationSession("ordered");
  expect(prisma.conversation.update).toHaveBeenCalledTimes(2);
  expect(prisma.conversation.update.mock.calls[1][0].data.sessionData.pet_name).toBe("Matías");
});
test("flush propagates database failure", async () => {
  prisma.conversation.update.mockRejectedValue(new Error("offline"));
  memory.hydrateSessionFromConversation("558", conv("fail", "t1", "Akiles"));
  memory.updateSession("558", { step: "awaiting_confirmation" }, "t1");
  await expect(memory.flushConversationSession("fail")).rejects.toThrow("offline");
  expect(memory.getSession("558", "t1")).toEqual({});
});
