const { classifyManagementRequest } = require("../../services/assistant-protocol.service");
test("negated cancellation is not a management command even when model says cancel", () => {
  expect(classifyManagementRequest("No quiero cancelar mi cita", "cancel_appointment")).toBeNull();
});
