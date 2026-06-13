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
    name: extractNameFromSession(latestConversation?.sessionData),
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

const listClients = async () => {
  const users = await prisma.user.findMany({
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
    name: extractNameFromSession(latestConversation?.sessionData),
    createdAt: user.createdAt,
    pets: user.pets,
    appointments: user.appointments,
    conversationsCount: user._count.conversations,
    latestConversationId: latestConversation?.id ?? null,
  };
};

module.exports = {
  listClients,
  getClientById,
};
