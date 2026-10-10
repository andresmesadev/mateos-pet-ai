jest.mock("axios", () => ({ post: jest.fn() }));
const axios = require("axios");
const { sendWhatsAppMessage } = require("../../services/whatsapp-api.service");
const previous = { id: process.env.WHATSAPP_PHONE_NUMBER_ID, token: process.env.WHATSAPP_ACCESS_TOKEN };
beforeAll(() => { process.env.WHATSAPP_PHONE_NUMBER_ID = "test-line"; process.env.WHATSAPP_ACCESS_TOKEN = "test-only"; });
afterAll(() => { if (previous.id === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID; else process.env.WHATSAPP_PHONE_NUMBER_ID = previous.id;
  if (previous.token === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN; else process.env.WHATSAPP_ACCESS_TOKEN = previous.token; });
beforeEach(() => jest.clearAllMocks());
test("network timeout is ambiguous and cannot be treated as confirmed rejection", async () => {
  axios.post.mockRejectedValue(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }));
  await expect(sendWhatsAppMessage("555", "test")).rejects.toMatchObject({ deliveryUncertain: true });
  expect(axios.post.mock.calls[0][2].timeout).toBe(20000);
});
test("explicit provider rejection remains a known failed attempt", async () => {
  axios.post.mockRejectedValue({ response: { status: 400, data: { error: { code: 131030 } } } });
  await expect(sendWhatsAppMessage("555", "test")).resolves.toBeNull();
});
