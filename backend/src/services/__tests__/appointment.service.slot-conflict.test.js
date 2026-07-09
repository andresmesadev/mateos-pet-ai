/**
 * Entregable 4.1 (Fase 4) — A6: verifica que createAppointment traduce la
 * violación del índice único parcial (appointment_tenant_bucket_slot_active_unique)
 * en SlotAlreadyBookedError, en vez de propagar el error crudo de Prisma.
 */
jest.mock("../../lib/prisma", () => ({
  appointment: { create: jest.fn() },
  user: { findUnique: jest.fn() },
}));
jest.mock("../google-calendar.service", () => ({
  createCalendarEvent: jest.fn(),
  cancelCalendarEvent: jest.fn(),
}));
jest.mock("../pet.service", () => ({
  findPetByNameAndOwner: jest.fn().mockRejectedValue(new Error("no pet")),
}));

const prisma = require("../../lib/prisma");
const { createAppointment } = require("../appointment.service");
const { SlotAlreadyBookedError } = require("../errors/slot-already-booked.error");

const baseData = {
  userId: "user-1",
  tenantId: "tenant-1",
  petName: "Firulais",
  petType: "dog",
  serviceType: "vet",
  date: new Date("2099-01-01T15:00:00.000Z"),
  status: "pending",
};

describe("createAppointment — conflicto de slot (A6)", () => {
  afterEach(() => jest.clearAllMocks());

  test("traduce P2002 del índice de colisión en SlotAlreadyBookedError", async () => {
    const conflictError = Object.assign(new Error("duplicate key"), {
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: {
            originalMessage:
              'duplicate key value violates unique constraint "appointment_tenant_bucket_slot_active_unique"',
          },
        },
      },
    });
    prisma.appointment.create.mockRejectedValue(conflictError);

    await expect(createAppointment(baseData)).rejects.toBeInstanceOf(SlotAlreadyBookedError);
  });

  test("incluye availabilityBucket derivado del serviceType en el insert", async () => {
    prisma.appointment.create.mockResolvedValue({ id: "appt-1", status: "pending" });

    await createAppointment(baseData);

    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ availabilityBucket: "vet" }),
    });
  });

  test("un P2002 no relacionado con el índice de colisión se propaga sin traducir", async () => {
    const otherError = Object.assign(new Error("otro conflicto"), { code: "P2002", meta: {} });
    prisma.appointment.create.mockRejectedValue(otherError);

    await expect(createAppointment(baseData)).rejects.toBe(otherError);
  });
});
