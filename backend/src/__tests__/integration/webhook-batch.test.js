jest.mock("../../services/whatsapp.service", () => ({ ...jest.requireActual("../../services/whatsapp.service"), processIncomingMessage: jest.fn() }));
jest.mock("../../services/inbound-job.service", () => ({ enqueueInboundJob: jest.fn().mockResolvedValue({ created: true }) }));
jest.mock("../../jobs/inbound-message.job", () => ({ requestInboundDrain: jest.fn() }));
const { receiveWebhook } = require("../../controllers/webhook.controller");
const { enqueueInboundJob } = require("../../services/inbound-job.service");
const valid = id => ({ id, from: "555", type: "text", text: { body: "Hola" } });
const body = messages => ({ object: "whatsapp_business_account", entry: [{ id: "business", changes: [{ field: "messages", value: { metadata: { phone_number_id: "line" }, messages } }] }] });
beforeEach(() => jest.clearAllMocks());
test("unsupported first message cannot hide supported second message", async () => {
  const res = { sendStatus: jest.fn() }, next = jest.fn();
  await receiveWebhook({ body: body([{ id: "unsupported", type: "reaction", from: "555" }, valid("supported")]) }, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(enqueueInboundJob).toHaveBeenCalledTimes(1);
  expect(enqueueInboundJob.mock.calls[0][0].payload.entry[0].changes[0].value.messages).toEqual([valid("supported")]);
});
test("every supported message has its own durable deduplication key", async () => {
  await receiveWebhook({ body: body([valid("one"), valid("two")]) }, { sendStatus: jest.fn() }, jest.fn());
  expect(enqueueInboundJob.mock.calls.map(([job]) => job.providerEventId)).toEqual(["one", "two"]);
});
