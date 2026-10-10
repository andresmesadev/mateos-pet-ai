jest.mock("../../lib/prisma", () => ({ inboundJob: { upsert: jest.fn() } }));
const prisma = require("../../lib/prisma");
const { recordDeliveryReceipts } = require("../../services/whatsapp-delivery-receipt.service");
const body = statuses => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "line" }, statuses } }] }] });
beforeEach(() => jest.clearAllMocks());
test("persists delivery evidence independently of the engine and strips recipient details", async () => {
  await recordDeliveryReceipts(body([{ id: "wamid.out", status: "delivered", timestamp: "1780000000", recipient_id: "secret-phone" }]));
  const call = prisma.inboundJob.upsert.mock.calls[0][0];
  expect(call.create).toMatchObject({ provider: "whatsapp_delivery", status: "done", phase: "complete", payload: { messageId: "wamid.out", status: "delivered" } });
  expect(JSON.stringify(call)).not.toContain("secret-phone");
  expect(call.update).toEqual({});
});
test("ignores malformed or unrecognized states", async () => {
  expect(await recordDeliveryReceipts(body([{ id: "a", status: "accepted", timestamp: "bad" }]))).toBe(0);
  expect(prisma.inboundJob.upsert).not.toHaveBeenCalled();
});
