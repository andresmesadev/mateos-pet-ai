jest.mock("../../contexts/services", () => ({ listAvailableServices: jest.fn() }));
const { listAvailableServices } = require("../../contexts/services");
const { listBusinessServices } = require("../../services/assistant-business-info.service");
test("business information uses active tenant-filtered catalog and never quotes raw base price", async () => {
  listAvailableServices.mockResolvedValue({ services: [{ name: "Baño básico", basePrice: 50000 }] });
  const reply = await listBusinessServices("tenant");
  expect(listAvailableServices).toHaveBeenCalledWith({ tenantId: "tenant" });
  expect(reply).toContain("Baño básico"); expect(reply).not.toContain("50000");
  expect(reply).not.toContain("cirugía");
});
