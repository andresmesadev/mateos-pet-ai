jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("../../lib/prisma", () => ({ appointment: { updateMany: jest.fn() } }));

const cron = require("node-cron");
const prisma = require("../../lib/prisma");
const { ARRIVAL_GRACE_MS, expireNoShowAppointments, startAppointmentNoShowJob } = require("../../jobs/appointment-no-show.job");

beforeEach(() => jest.clearAllMocks());

test("after 30 minutes only appointments without a recorded arrival become no-show", async () => {
  prisma.appointment.updateMany.mockResolvedValue({ count: 2 });
  const now = new Date("2026-09-29T15:30:00.000Z");

  const count = await expireNoShowAppointments(now);

  expect(ARRIVAL_GRACE_MS).toBe(1_800_000);
  expect(count).toBe(2);
  expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
    where: {
      status: { in: ["pending", "confirmed"] },
      date: { lte: new Date("2026-09-29T15:00:00.000Z") },
    },
    data: { status: "no_show" },
  });
});

test("sweep runs at startup and then every five minutes", async () => {
  prisma.appointment.updateMany.mockResolvedValue({ count: 0 });

  startAppointmentNoShowJob();
  await new Promise((resolve) => setImmediate(resolve));

  expect(cron.schedule).toHaveBeenCalledWith("45 */5 * * * *", expect.any(Function));
  expect(prisma.appointment.updateMany).toHaveBeenCalledTimes(1);
});
