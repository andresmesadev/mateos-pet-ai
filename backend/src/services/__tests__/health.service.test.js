jest.mock("../../lib/prisma", () => ({
  $queryRaw: jest.fn(),
}));

jest.mock("openai", () => {
  const mockModelsList = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({
    models: { list: mockModelsList },
  }));
  ctor.__mockModelsList = mockModelsList;
  return ctor;
});

const prisma = require("../../lib/prisma");
const OpenAI = require("openai");
const mockModelsList = OpenAI.__mockModelsList;
const { getHealthStatus } = require("../health.service");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getHealthStatus", () => {
  test("status 'ok' cuando la BD y OpenAI responden bien", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockModelsList.mockResolvedValue({ data: [] });

    const result = await getHealthStatus();

    expect(result.status).toBe("ok");
    expect(result.services).toEqual({ database: "ok", openai: "ok" });
    expect(result.version).toBe("2.36.0");
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  test("status 'degraded' si falla la conexión a la BD", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("db down"));
    mockModelsList.mockResolvedValue({ data: [] });

    const result = await getHealthStatus();
    expect(result.status).toBe("degraded");
    expect(result.services).toEqual({ database: "error", openai: "ok" });
  });

  test("status 'degraded' si falla la llamada a OpenAI", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockModelsList.mockRejectedValue(new Error("openai down"));

    const result = await getHealthStatus();
    expect(result.status).toBe("degraded");
    expect(result.services).toEqual({ database: "ok", openai: "error" });
  });

  test("status 'degraded' si falta OPENAI_API_KEY, sin llamar al SDK", async () => {
    delete process.env.OPENAI_API_KEY;
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const result = await getHealthStatus();
    expect(result.services.openai).toBe("error");
    expect(mockModelsList).not.toHaveBeenCalled();
  });
});
