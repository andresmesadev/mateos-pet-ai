jest.mock("../../lib/prisma", () => ({
  agendaException: { findMany: jest.fn() },
  appointment: { findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const {
  InvalidAgendaExceptionError,
  validateAgendaException,
  getAgendaExceptionForDate,
} = require("../../services/agenda-exception.service");

describe("agenda exceptions", () => {
  beforeEach(() => jest.clearAllMocks());

  test("un cierre no persiste horas y una apertura exige una ventana válida", () => {
    expect(validateAgendaException({ scope: "all", mode: "closed", startDate: "2026-12-25", open: "09:00", close: "13:00" }))
      .toMatchObject({ open: null, close: null });
    expect(() => validateAgendaException({ scope: "vet", mode: "open", startDate: "2026-12-25", open: "13:00", close: "09:00" }))
      .toThrow(InvalidAgendaExceptionError);
  });

  test("una excepción del servicio prevalece sobre una global", async () => {
    const global = { id: "global", scope: "all", mode: "closed" };
    const grooming = { id: "grooming", scope: "grooming", mode: "open", open: "09:00", close: "13:00" };
    prisma.agendaException.findMany.mockResolvedValue([global, grooming]);

    await expect(getAgendaExceptionForDate("tenant-a", "2026-12-25", "grooming")).resolves.toEqual(grooming);
    expect(prisma.agendaException.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-a", scope: { in: ["grooming", "all"] } }),
    }));
  });
});
