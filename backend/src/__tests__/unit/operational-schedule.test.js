const { getOperationalSchedules } = require("../../config/operational-schedule");

describe("operational schedules", () => {
  test("mantiene recuperación cada 15 minutos en modo normal", () => {
    expect(getOperationalSchedules()).toEqual({
      mode: "standard",
      eventDeliveryRetry: "0 */15 * * * *",
      abandonedConversation: "15 */15 * * * *",
      inboundRecovery: "30 */15 * * * *",
    });
  });
});
