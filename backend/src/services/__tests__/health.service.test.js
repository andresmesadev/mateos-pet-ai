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

jest.mock("../operational-health.service", () => ({
  getInboundWorkerHealth: jest.fn(() => ({
    status: "ok",
    healthy: true,
    startedAt: "2026-09-22T00:00:00.000Z",
    runningSince: null,
    lastSuccessAt: "2026-09-22T00:00:01.000Z",
    lastFailureAt: null,
    consecutiveFailures: 0,
    lastProcessedCount: 0,
  })),
}));

const prisma = require("../../lib/prisma");
const OpenAI = require("openai");
const operationalHealth = require("../operational-health.service");
const mockModelsList = OpenAI.__mockModelsList;
const { getHealthStatus } = require("../health.service");
const { readOpenAIProbe } = require('../provider-health-observation');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
  operationalHealth.getInboundWorkerHealth.mockReturnValue({
    status: "ok",
    healthy: true,
    startedAt: "2026-09-22T00:00:00.000Z",
    runningSince: null,
    lastSuccessAt: "2026-09-22T00:00:01.000Z",
    lastFailureAt: null,
    consecutiveFailures: 0,
    lastProcessedCount: 0,
  });
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getHealthStatus", () => {
  test("limita el sondeo de OpenAI a 8 segundos sin reintentos", () => {
    jest.isolateModules(() => {
      require("../health.service");
    });

    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 8_000,
      maxRetries: 0,
    }));
  });

  test("status 'ok' cuando la BD y OpenAI responden bien", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockModelsList.mockResolvedValue({ data: [] });

    const result = await getHealthStatus();

    expect(result.status).toBe("ok");
    expect(result.services).toEqual({ database: "ok", openai: "ok", inboundWorker: "ok" });
    expect(result.workers.inbound).toMatchObject({ status: "ok", healthy: true });
    expect(result.version).toBe(require("../../../package.json").version);
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  test("status 'degraded' si falla la conexión a la BD", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("db down"));
    mockModelsList.mockResolvedValue({ data: [] });

    const result = await getHealthStatus();
    expect(result.status).toBe("degraded");
    expect(result.services).toEqual({ database: "error", openai: "ok", inboundWorker: "ok" });
  });

  test("status 'degraded' si falla la llamada a OpenAI", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockModelsList.mockRejectedValue(new Error("openai down"));

    const result = await getHealthStatus();
    expect(result.status).toBe("degraded");
    expect(result.services).toEqual({ database: "ok", openai: "error", inboundWorker: "ok" });
  });

  test("status 'degraded' si falta OPENAI_API_KEY, sin llamar al SDK", async () => {
    delete process.env.OPENAI_API_KEY;
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const result = await getHealthStatus();
    expect(result.services.openai).toBe("error");
    expect(mockModelsList).not.toHaveBeenCalled();
  });

  test("un timeout de OpenAI conserva la señal de degradación y la salud de BD", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const timeout = new Error("Request timed out.");
    timeout.name = "APIConnectionTimeoutError";
    mockModelsList.mockRejectedValue(timeout);

    const result = await getHealthStatus();

    expect(result.status).toBe("degraded");
    expect(result.services).toEqual({ database: "ok", openai: "error", inboundWorker: "ok" });
    expect(mockModelsList).toHaveBeenCalledTimes(1);
  });

  test("el SDK real aborta a los 8 segundos y el controlador responde 503 sin reintentar", async () => {
    jest.useFakeTimers();
    const ActualOpenAI = jest.requireActual("openai");
    const stalledFetch = jest.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }));
    OpenAI.mockImplementationOnce(options => new ActualOpenAI({
      ...options,
      fetch: stalledFetch,
    }));

    try {
      let getHealth;
      jest.isolateModules(() => {
        require("../../lib/prisma").$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
        ({ getHealth } = require("../../controllers/health.controller"));
      });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const response = getHealth({}, res);

      await jest.advanceTimersByTimeAsync(7_999);
      expect(res.json).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await response;

      expect(stalledFetch).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "degraded",
        services: { database: "ok", openai: "error", inboundWorker: "ok" },
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  test("status 'degraded' si el worker entrante falla", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockModelsList.mockResolvedValue({ data: [] });
    operationalHealth.getInboundWorkerHealth.mockReturnValue({
      status: "error",
      healthy: false,
      consecutiveFailures: 2,
    });

    const result = await getHealthStatus();

    expect(result.status).toBe("degraded");
    expect(result.services.inboundWorker).toBe("error");
    expect(readOpenAIProbe()).toMatchObject({ ok: true });
  });
});
