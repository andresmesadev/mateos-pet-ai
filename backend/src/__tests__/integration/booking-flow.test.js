const express = require("express");
const request = require("supertest");
jest.mock("../../services/openai.service", () => ({ analyzeMessage: jest.fn() }));
const { analyzeMessage } = require("../../services/openai.service");
const routes = require("../../routes/test.routes");
const app = express(); app.use(express.json()); app.use("/api/test", routes);
beforeEach(() => jest.clearAllMocks());
test("extractor diagnostic never claims a booked appointment or stores a session", async () => {
  analyzeMessage.mockResolvedValue({ intent: "schedule_appointment", pet_name: "Max" });
  const response = await request(app).post("/api/test/analyze").send({ message: "Sí, confirmo" }).expect(200);
  expect(response.body.analysis.pet_name).toBe("Max");
  expect(response.body.session).toBeUndefined();
  expect(response.body.reply).toContain("no se creó ni modificó ninguna cita");
});
test.each(["", "   ", "x".repeat(4001)])("rejects invalid diagnostic input", async message => {
  await request(app).post("/api/test/analyze").send({ message }).expect(400);
  expect(analyzeMessage).not.toHaveBeenCalled();
});
