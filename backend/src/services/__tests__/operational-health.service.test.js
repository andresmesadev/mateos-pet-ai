const {
  startInboundWorkerHealth,
  markInboundRunStarted,
  markInboundRunSucceeded,
  markInboundRunFailed,
  getInboundWorkerHealth,
  resetOperationalHealthForTests,
} = require("../operational-health.service");

beforeEach(resetOperationalHealthForTests);

describe("operational health", () => {
  test("distingue inicio, ejecución correcta y fallo del worker", () => {
    const realNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;

    startInboundWorkerHealth({ expectedIntervalMs: 60_000 });
    expect(getInboundWorkerHealth({ now }).status).toBe("starting");

    markInboundRunStarted();
    markInboundRunSucceeded(3);
    expect(getInboundWorkerHealth({ now })).toMatchObject({
      status: "ok",
      healthy: true,
      lastProcessedCount: 3,
      consecutiveFailures: 0,
    });

    now += 1_000;
    markInboundRunStarted();
    markInboundRunFailed();
    expect(getInboundWorkerHealth({ now })).toMatchObject({
      status: "error",
      healthy: false,
      consecutiveFailures: 1,
    });

    Date.now = realNow;
  });

  test("detecta un worker que dejó de ejecutar su recuperación", () => {
    const realNow = Date.now;
    Date.now = () => 2_000_000;
    startInboundWorkerHealth({ expectedIntervalMs: 60_000 });
    markInboundRunStarted();
    markInboundRunSucceeded(0);
    Date.now = realNow;

    const result = getInboundWorkerHealth({ now: 2_000_000 + 60_000 + 10 * 60_000 + 1 });
    expect(result).toMatchObject({ status: "stale", healthy: false });
  });

  test("detecta una ejecución bloqueada por más de diez minutos", () => {
    const realNow = Date.now;
    Date.now = () => 3_000_000;
    startInboundWorkerHealth();
    markInboundRunStarted();
    Date.now = realNow;

    const result = getInboundWorkerHealth({ now: 3_000_000 + 10 * 60_000 + 1 });
    expect(result).toMatchObject({ status: "stalled", healthy: false });
  });
});
