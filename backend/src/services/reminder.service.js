const prisma = require("../lib/prisma");
const logger = require("../lib/logger");

// Entregable 3.1 — Comunicación: todo envío pasa exclusivamente por
// Enviar Mensaje. Ninguna llamada directa a sendWhatsAppMessage permanece
// en este archivo.
const { sendMessage } = require("../contexts/communication");

const {

  toDateKey,

  addOneDay,

  dayBoundsInTimezone,

  getHourInTimezone,

  formatSlotForUser,

  formatInTimeZone,

  TIMEZONE,

} = require("../lib/timezone");



const GROOMING_INTERVAL_DAYS = 30;

const VACCINE_LOOKAHEAD_DAYS = 15;

const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed"];



const SERVICE_LABELS = {

  vet: "Consulta veterinaria",

  grooming: "Baño y peluquería",

  general_appointment: "Cita general",

  medication: "Medicamentos",

};



const formatServiceLabel = (serviceType) => {

  const key = String(serviceType || "").trim().toLowerCase();

  return SERVICE_LABELS[key] ?? serviceType ?? "Cita";

};



const daysBetweenDateKeys = (fromKey, toKey) => {

  if (!fromKey || !toKey) {

    return null;

  }



  const [fy, fm, fd] = fromKey.split("-").map(Number);

  const [ty, tm, td] = toKey.split("-").map(Number);

  const fromMs = Date.UTC(fy, fm - 1, fd);

  const toMs = Date.UTC(ty, tm - 1, td);



  return Math.round((toMs - fromMs) / 86400000);

};



const addDaysToKey = (dateKey, days) => {

  let cursor = dateKey;



  for (let index = 0; index < days; index += 1) {

    cursor = addOneDay(cursor);



    if (!cursor) {

      return null;

    }

  }



  return cursor;

};



const formatDateLabel = (instant) => {

  const date = instant instanceof Date ? instant : new Date(instant);



  if (Number.isNaN(date.getTime())) {

    return "—";

  }



  return formatInTimeZone(date, TIMEZONE, "dd/MM/yyyy");

};



const getAppointmentsForReminder = async () => {

  try {

    const tomorrowKey = addOneDay(toDateKey(new Date()));



    if (!tomorrowKey) {

      logger.warn("[ReminderService] Could not resolve tomorrow date key");

      return [];

    }



    const { start, end } = dayBoundsInTimezone(tomorrowKey);



    const appointments = await prisma.appointment.findMany({

      where: {

        status: "confirmed",

        reminderSent: false,

        date: {

          gte: start,

          lte: end,

        },

      },

      include: {

        user: {

          select: {

            phone: true,

          },

        },

      },

      orderBy: {

        date: "asc",

      },

    });



    logger.info(

      `[ReminderService] Appointments for reminder (${tomorrowKey}): ${appointments.length}`

    );



    return appointments;

  } catch (error) {

    logger.error(

      "[ReminderService] getAppointmentsForReminder error:",

      error.message

    );

    throw error;

  }

};



const getUpcomingVaccineReminders = async () => {

  try {

    const todayKey = toDateKey(new Date());

    const endKey = addDaysToKey(todayKey, VACCINE_LOOKAHEAD_DAYS);



    if (!todayKey || !endKey) {

      return [];

    }



    const { start } = dayBoundsInTimezone(todayKey);

    const { end } = dayBoundsInTimezone(endKey);



    const records = await prisma.medicalRecord.findMany({

      where: {

        type: "vaccine",

        reminderSent: false,

        nextControlAt: {

          not: null,

          gte: start,

          lte: end,

        },

      },

      include: {

        pet: {

          select: {

            id: true,

            name: true,

            owner: {

              select: {

                id: true,

                phone: true,

                tenantId: true,

              },

            },

          },

        },

      },

      orderBy: {

        date: "asc",

      },

    });



    logger.info(

      `[ReminderService] Vaccine reminders due (${todayKey} → ${endKey}): ${records.length}`

    );



    return records;

  } catch (error) {

    logger.error(

      "[ReminderService] getUpcomingVaccineReminders error:",

      error.message

    );

    throw error;

  }

};



const getUpcomingDewormingReminders = async () => {
  try {
    const todayKey = toDateKey(new Date());
    const endKey = addDaysToKey(todayKey, VACCINE_LOOKAHEAD_DAYS);
    if (!todayKey || !endKey) return [];
    const { start } = dayBoundsInTimezone(todayKey);
    const { end } = dayBoundsInTimezone(endKey);

    const records = await prisma.medicalRecord.findMany({
      where: {
        type: "deworming",
        reminderSent: false,
        nextControlAt: { not: null, gte: start, lte: end },
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            owner: { select: { id: true, phone: true, tenantId: true } },
          },
        },
      },
      orderBy: { nextControlAt: "asc" },
    });

    logger.info(`[ReminderService] Deworming reminders due (${todayKey} → ${endKey}): ${records.length}`);
    return records;
  } catch (error) {
    logger.error("[ReminderService] getUpcomingDewormingReminders error:", error.message);
    throw error;
  }
};

const buildDewormingReminderMessage = (record) => {
  const petName = String(record?.pet?.name || "tu mascota").trim();
  const productName = String(record?.title || "desparasitante").trim();
  const dueDate = record?.nextControlAt ? new Date(record.nextControlAt) : null;
  const todayKey = toDateKey(new Date());
  const dueKey = dueDate ? toDateKey(dueDate) : null;
  const daysUntil = daysBetweenDateKeys(todayKey, dueKey);
  const daysLabel = daysUntil === 0 ? "hoy" : daysUntil === 1 ? "1 día" : `${daysUntil} días`;
  const dateLabel = dueDate ? formatDateLabel(dueDate) : "próximamente";

  return `Hola 👋

La próxima desparasitación de ${petName} con *${productName}* es en ${daysLabel} (el ${dateLabel}) 💊

¿Deseas que te la apliquemos en la clínica? Escríbenos aquí mismo 🐾`;
};

const sendDewormingReminder = async (record) => {
  const phone = String(record?.pet?.owner?.phone || "").trim();
  const userId = record?.pet?.owner?.id;
  if (!phone || !userId) {
    logger.warn("[ReminderService] Skipped deworming reminder — missing phone/userId:", record?.id);
    return false;
  }
  const message = buildDewormingReminderMessage(record);
  try {
    await sendMessage({
      tenantId: record?.pet?.owner?.tenantId ?? null,
      userId,
      phone,
      content: message,
      origin: "sistema",
    });
  } catch (error) {
    logger.error("[ReminderService] Failed to send deworming reminder:", record.id, phone, error.message);
    return false;
  }
  logger.info("[ReminderService] Deworming reminder sent:", record.id, phone);
  return true;
};

const markDewormingReminderSent = async (recordId) => {
  const id = String(recordId || "").trim();
  if (!id) throw new Error("recordId is required");
  await prisma.medicalRecord.update({ where: { id }, data: { reminderSent: true } });
  logger.info("[ReminderService] Deworming reminder marked sent:", id);
};

const getUpcomingGroomingReminders = async () => {
  try {
    const todayKey = toDateKey(new Date());
    const endKey = addDaysToKey(todayKey, VACCINE_LOOKAHEAD_DAYS);
    if (!todayKey || !endKey) return [];
    const { start } = dayBoundsInTimezone(todayKey);
    const { end } = dayBoundsInTimezone(endKey);

    // Recordatorios basados en nextControlAt de registros de peluquería
    const records = await prisma.medicalRecord.findMany({
      where: {
        type: "grooming",
        reminderSent: false,
        nextControlAt: { not: null, gte: start, lte: end },
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            owner: { select: { id: true, phone: true, tenantId: true } },
          },
        },
      },
      orderBy: { nextControlAt: "asc" },
    });

    logger.info(`[ReminderService] Grooming reminders due (${todayKey} → ${endKey}): ${records.length}`);
    return records;
  } catch (error) {
    logger.error("[ReminderService] getUpcomingGroomingReminders error:", error.message);
    throw error;
  }
};



const buildReminderMessage = (appointment) => {

  const instant =

    appointment.date instanceof Date

      ? appointment.date

      : new Date(appointment.date);

  const dateKey = toDateKey(instant);

  const hour = getHourInTimezone(instant);

  const dateTimeLabel = formatSlotForUser(dateKey, hour);

  const petName = String(appointment.petName || "tu mascota").trim();

  const serviceLabel = formatServiceLabel(appointment.serviceType);



  return `Hola 👋

Te recordamos que mañana tienes cita en Mateos Pet:

📅 ${dateTimeLabel}

🐾 ${petName} — ${serviceLabel}

Si necesitas cancelar o reprogramar escríbenos aquí mismo.`;

};



const buildVaccineReminderMessage = (record, user) => {

  const petName = String(record?.pet?.name || "tu mascota").trim();

  const vaccineName = String(record?.title || "vacuna").trim();

  const dueDate = record?.nextControlAt ? new Date(record.nextControlAt) : null;

  const todayKey = toDateKey(new Date());

  const dueKey = dueDate ? toDateKey(dueDate) : null;

  const daysUntil = daysBetweenDateKeys(todayKey, dueKey);

  const daysLabel =

    daysUntil === 0

      ? "hoy"

      : daysUntil === 1

        ? "1 día"

        : `${daysUntil} días`;

  const dateLabel = dueDate ? formatDateLabel(dueDate) : "próximamente";



  return `Hola 👋

La próxima vacuna *${vaccineName}* de ${petName} es en ${daysLabel} (el ${dateLabel}) 💉

¿Deseas agendar la cita? Escríbenos aquí mismo y te buscamos el mejor horario 🐾`;

};



const buildGroomingReminderMessage = (record) => {
  const petName = String(record?.pet?.name || "tu mascota").trim();
  const serviceName = String(record?.title || "baño y peluquería").trim();
  const dueDate = record?.nextControlAt ? new Date(record.nextControlAt) : null;
  const todayKey = toDateKey(new Date());
  const dueKey = dueDate ? toDateKey(dueDate) : null;
  const daysUntil = daysBetweenDateKeys(todayKey, dueKey);
  const daysLabel = daysUntil === 0 ? "hoy" : daysUntil === 1 ? "mañana" : `en ${daysUntil} días`;
  const dateLabel = dueDate ? formatDateLabel(dueDate) : "próximamente";

  return `Hola 👋

Es hora de la próxima visita de *${petName}* para *${serviceName}* ✂️
Fecha recomendada: ${daysLabel} (${dateLabel})

¿Agendamos el turno? Escríbenos aquí mismo 🛁`;
};



/**

 * @param {object} appointment — incluye user.phone

 * @returns {Promise<boolean>}

 */

const sendReminder = async (appointment) => {

  const phone = String(appointment?.user?.phone || "").trim();

  const userId = appointment?.userId;

  if (!phone || !userId) {

    logger.warn(

      "[ReminderService] Skipped reminder — missing phone/userId:",

      appointment?.id

    );

    return false;

  }



  const message = buildReminderMessage(appointment);

  try {

    await sendMessage({
      tenantId: appointment?.tenantId ?? null,
      userId,
      phone,
      content: message,
      origin: "sistema",
    });

  } catch (error) {

    logger.error(

      "[ReminderService] Failed to send reminder:",

      appointment.id,

      phone,

      error.message

    );

    return false;

  }



  logger.info("[ReminderService] Reminder sent:", appointment.id, phone);

  return true;

};



/**

 * @param {object} record — MedicalRecord con pet

 * @param {object} user — dueño con phone

 * @returns {Promise<boolean>}

 */

const sendVaccineReminder = async (record, user) => {

  const phone = String(user?.phone || record?.pet?.owner?.phone || "").trim();

  const userId = user?.id ?? record?.pet?.owner?.id;

  if (!phone || !userId) {

    logger.warn(

      "[ReminderService] Skipped vaccine reminder — missing phone/userId:",

      record?.id

    );

    return false;

  }



  const message = buildVaccineReminderMessage(record, user);

  try {

    await sendMessage({
      tenantId: user?.tenantId ?? record?.pet?.owner?.tenantId ?? null,
      userId,
      phone,
      content: message,
      origin: "sistema",
    });

  } catch (error) {

    logger.error(

      "[ReminderService] Failed to send vaccine reminder:",

      record.id,

      phone,

      error.message

    );

    return false;

  }



  logger.info("[ReminderService] Vaccine reminder sent:", record.id, phone);

  return true;

};



const sendGroomingReminder = async (record) => {
  const phone = String(record?.pet?.owner?.phone || "").trim();
  const userId = record?.pet?.owner?.id;
  if (!phone || !userId) {
    logger.warn("[ReminderService] Skipped grooming reminder — missing phone/userId:", record?.id);
    return false;
  }
  const message = buildGroomingReminderMessage(record);
  try {
    await sendMessage({
      tenantId: record?.pet?.owner?.tenantId ?? null,
      userId,
      phone,
      content: message,
      origin: "sistema",
    });
  } catch (error) {
    logger.error("[ReminderService] Failed to send grooming reminder:", record.id, phone, error.message);
    return false;
  }
  logger.info("[ReminderService] Grooming reminder sent:", record.id, phone);
  return true;
};



const markReminderSent = async (appointmentId) => {

  const id = String(appointmentId || "").trim();



  if (!id) {

    throw new Error("appointmentId is required");

  }



  await prisma.appointment.update({

    where: { id },

    data: { reminderSent: true },

  });



  logger.info("[ReminderService] Reminder marked sent:", id);

};



const markVaccineReminderSent = async (recordId) => {

  const id = String(recordId || "").trim();



  if (!id) {

    throw new Error("recordId is required");

  }



  await prisma.medicalRecord.update({

    where: { id },

    data: { reminderSent: true },

  });



  logger.info("[ReminderService] Vaccine reminder marked sent:", id);

};



const markGroomingReminderSent = async (recordId) => {
  const id = String(recordId || "").trim();
  if (!id) throw new Error("recordId is required");
  await prisma.medicalRecord.update({ where: { id }, data: { reminderSent: true } });
  logger.info("[ReminderService] Grooming reminder marked sent:", id);
};



const VET_SERVICE_TYPES = ["vet", "consultation"];

const getConsultationsForFollowUp = async () => {
  try {
    const yesterdayKey = toDateKey(new Date(Date.now() - 86_400_000));
    const { start, end } = dayBoundsInTimezone(yesterdayKey);

    const appointments = await prisma.appointment.findMany({
      where: {
        serviceType: { in: VET_SERVICE_TYPES },
        status: { not: "cancelled" },
        followUpSent: false,
        date: { gte: start, lte: end },
      },
      include: {
        user: { select: { phone: true } },
        pet: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });

    logger.info(
      `[ReminderService] Consultations for follow-up (${yesterdayKey}): ${appointments.length}`
    );

    return appointments;
  } catch (error) {
    logger.error("[ReminderService] getConsultationsForFollowUp error:", error.message);
    throw error;
  }
};

const buildFollowUpMessage = (appointment) => {
  const petName = String(
    appointment.pet?.name ?? appointment.petName ?? "tu mascota"
  ).trim();

  return `Hola 👋 ¿Cómo está ${petName} después de la consulta de ayer? Si notas algo diferente o tienes alguna duda, escríbenos aquí mismo 🐾`;
};

const sendFollowUp = async (appointment) => {
  const phone = String(appointment?.user?.phone || "").trim();
  const userId = appointment?.userId;

  if (!phone || !userId) {
    logger.warn("[ReminderService] Skipped follow-up — missing phone/userId:", appointment?.id);
    return false;
  }

  const message = buildFollowUpMessage(appointment);
  try {
    await sendMessage({
      tenantId: appointment?.tenantId ?? null,
      userId,
      phone,
      content: message,
      origin: "sistema",
    });
  } catch (error) {
    logger.error("[ReminderService] Failed to send follow-up:", appointment.id, phone, error.message);
    return false;
  }

  logger.info("[ReminderService] Follow-up sent:", appointment.id, phone);
  return true;
};

const markFollowUpSent = async (appointmentId) => {
  const id = String(appointmentId || "").trim();

  if (!id) {
    throw new Error("appointmentId is required");
  }

  await prisma.appointment.update({
    where: { id },
    data: { followUpSent: true },
  });

  logger.info("[ReminderService] Follow-up marked sent:", id);
};

const resetGroomingReminderForPet = async (petId) => {

  const id = String(petId || "").trim();



  if (!id) {

    return;

  }



  try {

    await prisma.pet.update({

      where: { id },

      data: { groomingReminderSent: false },

    });

  } catch (error) {

    logger.warn(

      "[ReminderService] resetGroomingReminderForPet skipped:",

      error.message

    );

  }

};



module.exports = {
  getAppointmentsForReminder,
  getUpcomingVaccineReminders,
  getUpcomingDewormingReminders,
  getUpcomingGroomingReminders,
  getConsultationsForFollowUp,
  sendReminder,
  sendVaccineReminder,
  sendDewormingReminder,
  sendGroomingReminder,
  sendFollowUp,
  markReminderSent,
  markVaccineReminderSent,
  markDewormingReminderSent,
  markGroomingReminderSent,
  markFollowUpSent,
  resetGroomingReminderForPet,
  buildReminderMessage,
  buildVaccineReminderMessage,
  buildDewormingReminderMessage,
  buildGroomingReminderMessage,
  buildFollowUpMessage,
};


