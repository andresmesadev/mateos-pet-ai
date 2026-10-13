jest.mock("../../../lib/prisma", () => ({ message: { findFirst: jest.fn() } }));
const prisma = require("../../../lib/prisma");
const { PrismaMessageRepository } = require("../infrastructure/persistence/prisma-message.repository");

test("latest incoming timestamp spans owner threads, scopes tenant and never reads content", async () => {
  const date = new Date("2026-10-13T12:00:00Z");
  prisma.message.findFirst.mockResolvedValue({ createdAt: date });
  expect(await new PrismaMessageRepository().findLatestIncomingAt("owner", "tenant")).toBe(date);
  expect(prisma.message.findFirst).toHaveBeenCalledWith({
    where: { role: "user", conversation: { userId: "owner", tenantId: "tenant" } },
    orderBy: { createdAt: "desc" }, select: { createdAt: true },
  });
});
