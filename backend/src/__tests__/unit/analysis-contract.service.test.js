const { validateAnalysis } = require("../../services/analysis-contract.service");
test.each([[], null, { intent: "delete_database" }])("rejects invalid extraction %j", input => expect(validateAnalysis(input)).toBeNull());
test("model cannot inject state, IDs, objects or arbitrary services", () => {
  const result = validateAnalysis({ intent: "schedule_appointment", step: "completed", userId: "other", pet_name: {}, pet_type: "dragon", requested_service: "surgery" });
  expect(result).toEqual({ intent: "schedule_appointment", pet_name: null, pet_type: null, requested_service: null, client_name: null, date: null, time: null });
});
