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

// Clientes de peluquería cuya última visita fue hace más de 60 días.
// Carga en batches de 500 para no agotar la memoria con bases de datos grandes.
const INACTIVE_BATCH = 500;
const INACTIVE_MAX = 1000;

const listInactiveClients = async (tenantId) => {
  const cutoff = new Date(Date.now() - 60 * 86_400_000);
  const tenantFilter = tenantId ? { tenantId } : {};

  const users = await prisma.user.findMany({
    where: {
      ...tenantFilter,
      pets: { some: { medicalRecords: { some: { type: "grooming" } } } },
    },
    include: {
      pets: {
        select: {
          name: true,
          type: true,
          medicalRecords: {
            where: { type: "grooming" },
            orderBy: { date: "desc" },
            take: 1,
            select: { date: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    take: INACTIVE_BATCH,
  });

  const result = [];
  for (const u of users) {
    const groomingDates = u.pets
      .flatMap((p) => p.medicalRecords.map((r) => r.date))
      .filter(Boolean)
      .map((d) => new Date(d));
    const lastGrooming = groomingDates.length
      ? new Date(Math.max(...groomingDates.map((d) => d.getTime())))
      : null;

    // Solo inactivos: última visita de grooming anterior al cutoff (60 días)
    if (lastGrooming && lastGrooming >= cutoff) continue;

    result.push({
      id: u.id,
      phone: u.phone,
      name: u.name ?? null,
      pets: u.pets.slice(0, 3).map(({ name, type }) => ({ name, type })),
      lastVisitDate: lastGrooming ? lastGrooming.toISOString() : null,
    });

    if (result.length >= INACTIVE_MAX) break;
  }

  // Ordenar: menos inactivo primero (última visita más reciente = mayor fecha)
  result.sort((a, b) => {
    if (!a.lastVisitDate && !b.lastVisitDate) return 0;
    if (!a.lastVisitDate) return 1;
    if (!b.lastVisitDate) return -1;
    return new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime();
  });

  return result;
};

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
};
