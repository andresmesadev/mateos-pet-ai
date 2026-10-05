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

const PAGE_SIZE = 50;

const listClients = async (tenantId, { page = 1, limit = PAGE_SIZE, search = "" } = {}) => {
  const take = Math.min(Number(limit) || PAGE_SIZE, 200);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const searchFilter = search?.trim()
    ? {
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { phone: { contains: search.trim() } },
        ],
      }
    : {};

  const tenantFilter = tenantId ? { tenantId } : {};
  const where = { ...tenantFilter, ...searchFilter };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { pets: true, appointments: true } },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, updatedAt: true, sessionData: true },
        },
      },
    }),
  ]);

  const data = users.map(mapClientSummary);
  return { data, total, page: currentPage, totalPages: Math.ceil(total / take) };
};

const getClientById = async (clientId, tenantId) => {
  const id = String(clientId || "").trim();

  if (!id) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: tenantId ? { id, tenantId } : { id },
    include: {
      pets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          breed: true,
          gender: true,
          birthDate: true,
          weight: true,
          sterilized: true,
          notes: true,
          operationalAlerts: true,
          defaultGroomingPrice: true,
          _count: { select: { medicalRecords: true, appointments: true } },
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
    phoneAlt: user.phoneAlt ?? null,
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

// Preserve the old array response for consumers without pagination parameters.
const { listInactiveClientsPage } = require('./dashboard-inactive-clients.service');
const listInactiveClients = async tenantId => (await listInactiveClientsPage(tenantId, { limit: 500 })).data;

const updateClient = async (id, { name, phone, phoneAlt, email, address, notes }) => {
  return prisma.user.update({
    where: { id },
    data: {
      name: name ?? undefined,
      phone: phone ?? undefined,
      phoneAlt: phoneAlt ?? undefined,
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
  listInactiveClientsPage,
};
