const prisma = require("../lib/prisma");
const { sendWhatsAppMessage } = require("./whatsapp-api.service");

const VALID_TYPES = ["control", "vaccine", "grooming", "exam", "treatment", "other"];
const VALID_STATUSES = ["pending", "done", "dismissed"];
const GROOMING_CYCLE_DAYS = 30;

function validateType(type) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Tipo inválido. Valores permitidos: ${VALID_TYPES.join(", ")}`);
  }
}

/**
 * List pending next actions for a pet (tenant-scoped).
 */
async function listNextActions(petId, tenantId, { includeAll = false } = {}) {
  const where = { petId };
  if (tenantId) where.tenantId = tenantId;
  if (!includeAll) where.status = "pending";
  return prisma.petNextAction.findMany({
    where,
    orderBy: { dueAt: "asc" },
  });
}

/**
 * Create a next action. Auto-resolves petId's tenantId if not provided.
 */
async function createNextAction({
  petId,
  tenantId,
  type,
  notes,
  dueAt,
  sourceRecordId = null,
  sourceAppointmentId = null,
}) {
  validateType(type);
  return prisma.petNextAction.create({
    data: {
      petId,
      tenantId: tenantId ?? null,
      type,
      notes: notes?.trim() || null,
      dueAt: new Date(dueAt),
      status: "pending",
      sourceRecordId,
      sourceAppointmentId,
    },
  });
}

/**
 * Update status of a next action with tenant ownership check.
 */
async function updateNextAction(id, tenantId, { status, notes, dueAt }) {
  const where = tenantId ? { id, tenantId } : { id };
  const existing = await prisma.petNextAction.findFirst({ where });
  if (!existing) return null;

  if (status && !VALID_STATUSES.includes(status)) {
    throw new Error(`Estado inválido. Valores: ${VALID_STATUSES.join(", ")}`);
  }

  return prisma.petNextAction.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
    },
  });
}

/**
 * Auto-create or refresh a "control" action from a medical record's nextControlAt.
 * Uses upsert by sourceRecordId so saving the record twice doesn't duplicate.
 */
async function upsertControlFromRecord({ petId, tenantId, recordId, dueAt, notes }) {
  // Delete stale one for this record if date changed, then re-create
  await prisma.petNextAction.deleteMany({
    where: { sourceRecordId: recordId, status: "pending" },
  });
  if (!dueAt) return null;
  return createNextAction({
    petId,
    tenantId,
    type: "control",
    notes,
    dueAt,
    sourceRecordId: recordId,
  });
}

/**
 * Auto-create a grooming reminder 30 days after a completed grooming appointment.
 * Idempotent: skips if a pending grooming action already exists for this appointment.
 */
async function createGroomingReminderIfNeeded({ petId, tenantId, appointmentId, appointmentDate }) {
  const existing = await prisma.petNextAction.findFirst({
    where: { sourceAppointmentId: appointmentId, type: "grooming", status: "pending" },
  });
  if (existing) return existing;

  const dueAt = new Date(new Date(appointmentDate).getTime() + GROOMING_CYCLE_DAYS * 86_400_000);
  return createNextAction({
    petId,
    tenantId,
    type: "grooming",
    notes: `Siguiente baño / grooming (${GROOMING_CYCLE_DAYS} días desde último)`,
    dueAt,
    sourceAppointmentId: appointmentId,
  });
}

/**
 * Summary counts for the dashboard widget — how many pets have pending actions.
 */
async function pendingActionsSummary(tenantId) {
  const where = { status: "pending" };
  if (tenantId) where.tenantId = tenantId;

  const rows = await prisma.petNextAction.groupBy({
    by: ["type"],
    where,
    _count: { id: true },
  });

  const byType = Object.fromEntries(rows.map((r) => [r.type, r._count.id]));
  const total = rows.reduce((sum, r) => sum + r._count.id, 0);

  // Count distinct pets with at least one overdue action
  const now = new Date();
  const overdueRaw = await prisma.petNextAction.findMany({
    where: { ...where, dueAt: { lt: now } },
    select: { petId: true },
    distinct: ["petId"],
  });

  return { total, byType, overduePets: overdueRaw.length };
}

const TYPE_MESSAGES = {
  control: (petName, ownerName, dueAt) => {
    const due = dueAt ? new Date(dueAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "long" }) : "próximamente";
    return `Hola ${ownerName ?? "cliente"} 👋\n\nTe recordamos que ${petName} tiene un control veterinario pendiente (${due}).\n\n¿Cuándo te queda bien para la cita? Escríbenos aquí y lo agendamos 🐾`;
  },
  vaccine: (petName, ownerName, dueAt) => {
    const due = dueAt ? new Date(dueAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "long" }) : "próximamente";
    return `Hola ${ownerName ?? "cliente"} 👋\n\n${petName} tiene una vacuna pendiente para el ${due}.\n\n¿Deseas agendar la cita? Escríbenos aquí 💉`;
  },
  grooming: (petName, ownerName) =>
    `Hola ${ownerName ?? "cliente"} 👋\n\n¡Es hora del baño y peluquería de ${petName}! 🛁✂️\n\n¿Cuándo te queda bien? Escríbenos aquí y te damos turno.`,
  exam: (petName, ownerName) =>
    `Hola ${ownerName ?? "cliente"} 👋\n\nTe recordamos que ${petName} tiene un examen pendiente. ¿Quieres agendar? Escríbenos aquí 🔬`,
  treatment: (petName, ownerName) =>
    `Hola ${ownerName ?? "cliente"} 👋\n\nTe recordamos que ${petName} tiene un tratamiento pendiente. ¿Quieres coordinar? Escríbenos aquí 🩹`,
  other: (petName, ownerName) =>
    `Hola ${ownerName ?? "cliente"} 👋\n\nTe recordamos que tienes una acción pendiente para ${petName}. ¿Podemos ayudarte? Escríbenos aquí 🐾`,
};

function buildActionMessage(type, petName, ownerName, dueAt, notes) {
  const builder = TYPE_MESSAGES[type] ?? TYPE_MESSAGES.other;
  let msg = builder(petName, ownerName, dueAt);
  if (notes) msg += `\n\n📝 ${notes}`;
  return msg;
}

/**
 * Bulk-send WhatsApp reminders for all pending actions of a given type in a tenant.
 * Skips actions already sent. Returns { sent, skipped, noPhone }.
 */
async function sendNextActionReminders({ tenantId, type }) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Tipo inválido: ${type}`);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 180 * 86_400_000);
  const windowEnd = new Date(now.getTime() + 60 * 86_400_000);

  const tenantWhere = tenantId ? { pet: { owner: { tenantId } } } : {};

  const records = await prisma.medicalRecord.findMany({
    where: {
      ...tenantWhere,
      type,
      reminderSent: false,
      nextControlAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      pet: {
        select: {
          name: true,
          owner: { select: { name: true, phone: true } },
        },
      },
    },
    orderBy: { nextControlAt: "asc" },
  });

  let sent = 0;
  let noPhone = 0;

  for (const r of records) {
    const phone = r.pet?.owner?.phone;
    if (!phone) { noPhone++; continue; }

    const petName = r.pet.name ?? "tu mascota";
    const ownerName = r.pet.owner?.name ?? null;
    const message = buildActionMessage(r.type, petName, ownerName, r.nextControlAt, r.title);

    const ok = await sendWhatsAppMessage(phone, message);
    if (ok) {
      await prisma.medicalRecord.update({
        where: { id: r.id },
        data: { reminderSent: true },
      });
      sent++;
    }
  }

  return { sent, noPhone, total: records.length };
}

module.exports = {
  VALID_TYPES,
  listNextActions,
  createNextAction,
  updateNextAction,
  upsertControlFromRecord,
  createGroomingReminderIfNeeded,
  pendingActionsSummary,
  sendNextActionReminders,
};
