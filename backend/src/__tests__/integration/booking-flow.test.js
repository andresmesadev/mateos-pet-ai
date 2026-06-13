const express = require("express");
const request = require("supertest");

jest.mock("../../services/openai.service");
jest.mock("../../services/availability-db.service");
jest.mock("../../services/medical-detection.service");

const { analyzeMessage } = require("../../services/openai.service");
const availabilityDb = require("../../services/availability-db.service");
const { detectMedicalInfo } = require("../../services/medical-detection.service");
const { clearSession } = require("../../services/memory.service");
const { STEPS } = require("../../services/conversation.service");
const testRoutes = require("../../routes/test.routes");
const errorHandler = require("../../middlewares/error.middleware");

const TEST_PHONE = "573001234567";
const FIXED_NOW = new Date("2026-06-10T17:00:00.000Z");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/test", testRoutes);
  app.use(errorHandler);
  return app;
};

describe("POST /api/test/analyze booking flow", () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    clearSession(TEST_PHONE);
    jest.clearAllMocks();

    availabilityDb.isSlotAvailable.mockResolvedValue(true);
    availabilityDb.findNextGroomingSlotFromDb = jest
      .fn()
      .mockResolvedValue(null);
    detectMedicalInfo.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("flujo completo: servicio → nombre → tipo → fecha → confirmación", async () => {
    analyzeMessage.mockImplementation(async (input) => {
      const message =
        typeof input === "string" ? input : String(input?.message || "");

      if (/consulta veterinaria/i.test(message)) {
        return {
          intent: "schedule_appointment",
          requested_service: "veterinary_consultation",
          pet_type: null,
          pet_name: null,
          date: null,
          time: null,
        };
      }

      if (/^max$/i.test(message.trim())) {
        return {
          intent: "schedule_appointment",
          requested_service: "veterinary_consultation",
          pet_type: null,
          pet_name: "Max",
          date: null,
          time: null,
        };
      }

      if (/^perro$/i.test(message.trim())) {
        return {
          intent: "schedule_appointment",
          requested_service: "veterinary_consultation",
          pet_type: "dog",
          pet_name: "Max",
          date: null,
          time: null,
        };
      }

      if (/mañana/i.test(message)) {
        return {
          intent: "schedule_appointment",
          requested_service: "veterinary_consultation",
          pet_type: "dog",
          pet_name: "Max",
          date: "mañana",
          time: "2pm",
        };
      }

      if (/^(si|sí|confirmar)$/i.test(message.trim())) {
        return {
          intent: "schedule_appointment",
          requested_service: "veterinary_consultation",
          pet_type: "dog",
          pet_name: "Max",
          date: "mañana",
          time: "2pm",
        };
      }

      return {
        intent: "other",
        pet_type: null,
        pet_name: null,
        requested_service: null,
        date: null,
        time: null,
      };
    });

    const step1 = await request(app)
      .post("/api/test/analyze")
      .send({ message: "Quiero una consulta veterinaria para mi perro" })
      .expect(200);

    expect(step1.body.success).toBe(true);
    expect(step1.body.session.step).toBe(STEPS.AWAITING_PET_NAME);
    expect(step1.body.reply).toMatch(/nombre/i);

    const step2 = await request(app)
      .post("/api/test/analyze")
      .send({ message: "Max" })
      .expect(200);

    expect(step2.body.session.step).toBe(STEPS.AWAITING_PET_TYPE);
    expect(step2.body.session.pet_name).toBe("Max");

    const step3 = await request(app)
      .post("/api/test/analyze")
      .send({ message: "perro" })
      .expect(200);

    expect(step3.body.session.step).toBe(STEPS.AWAITING_DATE_TIME);
    expect(step3.body.session.pet_type).toBe("dog");
    expect(step3.body.reply).toMatch(/día y hora/i);

    const step4 = await request(app)
      .post("/api/test/analyze")
      .send({ message: "mañana a las 2pm" })
      .expect(200);

    expect(step4.body.session.step).toBe(STEPS.AWAITING_CONFIRMATION);
    expect(step4.body.session.scheduling_date_key).toBe("2026-06-11");
    expect(step4.body.session.scheduling_hour).toBe(14);
    expect(step4.body.reply).toMatch(/confirm/i);

    const step5 = await request(app)
      .post("/api/test/analyze")
      .send({ message: "si" })
      .expect(200);

    expect(step5.body.session.step).toBe(STEPS.COMPLETED);
    expect(step5.body.reply).toMatch(/confirmada/i);
  });

  test("rechaza mensaje vacío", async () => {
    const response = await request(app)
      .post("/api/test/analyze")
      .send({ message: "   " })
      .expect(400);

    expect(response.body.success).toBe(false);
  });
});
