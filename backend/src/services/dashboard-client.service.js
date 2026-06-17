const prisma = require("../lib/prisma");

const NAME_KEYS = [
  "name",
  "owner_name",
  "client_name",
  "user_name",
  "customer_name",
];

const parseSessionData = (sessionData) => {
  if (
    sessionData &&
    typeof sessionData === "object" &&
    !Array.isArray(sessionData)
  ) {
    return sessionData;
  }

  return {};
};

const extractNameFromSession = (sessionData) => {
  const data = parseSessionData(sessionData);

  for (const key of NAME_KEYS) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const mapClientSummary = (user) => {
  const latestConversation = user.conversations?.[0] ?? null;

  return {
    id: user.id,
    phone: user.phone,
    name: user.name ?? extractNameFromSession(latestConversation?.sessionData),
    petsCount: user._count.pets,
    appointmentsCount: user._count.appointments,
    lastConversation: latestConversation
      ? {
          id: latestConversation.id,
          updatedAt: latestConversation.updatedAt,
        }
      : null,
    lastActivityAt:
      latestConversation?.updatedAt ?? user.createdAt,
    createdAt: user.createdAt,
  };
};

const listClients = async (tenantId) => {
  const tenantFilter = tenantId ? { tenantId } : {};
  const users = await prisma.user.findMany({
    where: tenantFilter,
    include: {
      _count: {
        select: {
          pets: true,
          appointments: true,
        },
      },
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          updatedAt: true,
          sessionData: true,
        },
      },
    },
  });

  return users
    .map(mapClientSummary)
    .sort(
      (left, right) =>
        new Date(right.lastActivityAt).getTime() -
        new Date(left.lastActivityAt).getTime()
    );
};

const getClientById = async (clientId) => {
  const id = String(clientId || "").trim();

  if (!id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      pets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      appointments: {
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true,
          petName: true,
          petType: true,
          serviceType: true,
          date: true,
          status: true,
        },
      },
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          sessionData: true,
        },
      },
      _count: {
        select: {
          conversations: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const latestConversation = user.conversations[0] ?? null;

  return {
    id: user.id,
    phone: user.phone,
    name: user.name ?? extractNameFromSession(latestConversation?.sessionData),
    email: user.email ?? null,
    address: user.address ?? null,
    notes: user.notes ?? null,
    createdAt: user.createdAt,
    pets: user.pets,
    appointments: user.appointments,
    conversationsCount: user._count.conversations,
    latestConversationId: latestConversation?.id ?? null,
  };
};

const listInactiveClients = async (tenantId) => {
  const cutoff = new Date(Date.now() - 60 * 86_400_000);
  const tenantFilter = tenantId ? { tenantId } : {};

  const users = await prisma.user.findMany({
    where: {
      ...tenantFilter,
      AND: [
        { appointments: { some: {} } },
        { appointments: { none: { date: { gte: cutoff } } } },
      ],
    },
    include: {
      pets: {
        select: { name: true, type: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      appointments: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    phone: u.phone,
    name: u.name ?? null,
    pets: u.pets,
    lastAppointmentDate: u.appointments[0]?.date ?? null,
  }));
};

const updateClient = async (id, { name, email, address, notes }) => {
  return prisma.user.update({
    where: { id },
    data: {
      name: name ?? undefined,
      email: email ?? undefined,
      address: address ?? undefined,
      notes: notes ?? undefined,
    },
  });
};

module.exports = {
  listClients,
  getClientById,
  updateClient,
  listInactiveClients,
};
