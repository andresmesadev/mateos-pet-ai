jest.mock("../../lib/prisma", () => ({
  agendaException: { findMany: jest.fn() },
  appointment: { findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const {
  InvalidAgendaExceptionError,
  validateAgendaException,
  getAgendaExceptionForDate,
  getAffectedAppointments,
} = require("../../services/agenda-exception.service");

describe("agenda exceptions", () => {
  beforeEach(() => jest.clearAllMocks());

  test("la vista previa compara minutos a ambos lados de la apertura y el cierre", async () => {
    prisma.appointment.findMany.mockResolvedValue([
      { id: "before", date: new Date("2026-10-06T15:15:00Z"), serviceType: "vet" },
      { id: "inside", date: new Date("2026-10-06T15:45:00Z"), serviceType: "vet" },
      { id: "after", date: new Date("2026-10-06T20:15:00Z"), serviceType: "vet" },
    ]);
    const rows = await getAffectedAppointments("tenant-a", { scope: "all", mode: "open", startDate: "2026-10-06", open: "10:30", close: "15:10" });
    expect(rows.map(row => row.id)).toEqual(["before", "after"]);
  });

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
