const { getOperationalSchedules } = require("../../config/operational-schedule");

describe("operational schedules", () => {
  test("mantiene recuperación cada 15 minutos en modo normal", () => {
    expect(getOperationalSchedules({ lowUsage: false })).toEqual({
      mode: "standard",
      eventDeliveryRetry: "0 */15 * * * *",
      abandonedConversation: "15 */15 * * * *",
      inboundRecovery: "30 */15 * * * *",
    });
  });

  test("agrupa los tres barridos una vez por hora en desarrollo de bajo consumo", () => {
    expect(getOperationalSchedules({ lowUsage: true })).toEqual({
      mode: "low-usage",
      eventDeliveryRetry: "0 0 * * * *",
      abandonedConversation: "15 0 * * * *",
      inboundRecovery: "30 0 * * * *",
    });
  });

  test("lee el modo de bajo consumo desde el entorno", () => {
    const previous = process.env.NEON_LOW_USAGE_MODE;
    process.env.NEON_LOW_USAGE_MODE = "true";
    expect(getOperationalSchedules().mode).toBe("low-usage");
    if (previous === undefined) delete process.env.NEON_LOW_USAGE_MODE;
    else process.env.NEON_LOW_USAGE_MODE = previous;
  });
});
