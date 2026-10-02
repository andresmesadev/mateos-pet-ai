const prisma = require("../lib/prisma");

const categoryWhere = (role) => role === "vet" ? { OR: [
  { service: { is: { category: { is: { name: "veterinary" } } } } },
  { serviceId: null, serviceType: { in: ["vet", "consultation", "veterinary_consultation"] } },
] } : role === "groomer" ? { OR: [
  { service: { is: { category: { is: { name: "grooming" } } } } },
  { serviceId: null, serviceType: { in: ["grooming", "bath_grooming", "bath", "baño", "corte", "spa", "deslanado", "antipulgas", "peluqueria", "peluquería", "colorimetria", "colorimetría"] } },
] } : {};

const appointmentSelect = { id: true, date: true, status: true, petId: true, petName: true, serviceType: true,
  service: { select: { name: true, category: { select: { name: true } } } },
  staff: { select: { name: true } }, pet: { select: { name: true } } };
const map = (row) => row ? { id: row.id, date: row.date, status: row.status, petId: row.petId,
  petName: row.pet?.name || row.petName, serviceName: row.service?.name || row.serviceType,
  category: row.service?.category?.name || null, professional: row.staff?.name || null } : null;

async function getConversationContext(conversationId, tenantId, role, access) {
  const anchor = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId }, select: { userId: true } });
  if (!anchor) return null;
  const client = await prisma.user.findFirst({ where: { id: anchor.userId, tenantId }, select: {
    id: true, name: true, phone: true, phoneAlt: true, email: true, address: true,
    pets: { orderBy: { name: "asc" }, select: { id: true, name: true, type: true, breed: true } },
  } });
  if (!client) return null;
  const enabledCategories = access?.activeModules?.filter(module => ["veterinary", "grooming"].includes(module));
  const areaFilter = enabledCategories ? { OR: enabledCategories.map(module => categoryWhere(module === "veterinary" ? "vet" : "groomer")) } : {};
  const where = { tenantId, userId: client.id, AND: [categoryWhere(role), areaFilter] };
  const now = new Date();
  const [upcoming, active, last] = await Promise.all([
    prisma.appointment.findMany({ where: { ...where, date: { gte: now }, status: { in: ["pending", "confirmed", "arrived"] } }, select: appointmentSelect, orderBy: { date: "asc" }, take: 3 }),
    prisma.appointment.findMany({ where: { ...where, status: { in: ["arrived", "in_progress"] }, date: { lt: now } }, select: appointmentSelect, orderBy: { date: "desc" }, take: 3 }),
    prisma.appointment.findFirst({ where: { ...where, status: "completed", date: { lte: now } }, select: appointmentSelect, orderBy: { date: "desc" } }),
  ]);
  return { client, upcoming: upcoming.map(map), active: active.map(map), lastVisit: map(last), permissions: {
    role, canViewClient: access ? access.capabilities.contacts : ["admin", "receptionist"].includes(role), canViewClinical: access ? access.capabilities.clinical : ["admin", "vet"].includes(role),
    canViewGrooming: access ? access.capabilities.grooming : ["admin", "groomer"].includes(role), canCreateAppointment: access ? access.capabilities.schedule : ["admin", "receptionist"].includes(role),
  } };
}
module.exports = { getConversationContext, categoryWhere };
