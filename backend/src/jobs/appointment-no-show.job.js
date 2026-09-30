const cron = require("node-cron");
const prisma = require("../lib/prisma");
const { getOperationalSchedules } = require("../config/operational-schedule");
const { ARRIVAL_GRACE_MS } = require("../services/appointment-status.service");

let sweepRunning = false;

// La ausencia solo puede inferirse si nunca se registró la llegada.
// Una cita "arrived" o "in_progress" requiere revisión humana aunque venza.
async function expireNoShowAppointments(now = new Date()) {
  const cutoff = new Date(now.getTime() - ARRIVAL_GRACE_MS);
  const result = await prisma.appointment.updateMany({
    where: { status: { in: ["pending", "confirmed"] }, date: { lte: cutoff } },
    data: { status: "no_show" },
  });
  return result.count;
}

async function runNoShowSweep() {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const count = await expireNoShowAppointments();
    if (count > 0) console.info(`[AppointmentNoShowJob] ${count} cita(s) marcadas como no asistió`);
  } catch (error) {
    console.error("[AppointmentNoShowJob] No se pudo cerrar las citas sin llegada:", error);
  } finally {
    sweepRunning = false;
  }
}

function startAppointmentNoShowJob() {
  void runNoShowSweep();
  cron.schedule(getOperationalSchedules().appointmentNoShow, () => { void runNoShowSweep(); });
}

module.exports = { ARRIVAL_GRACE_MS, expireNoShowAppointments, runNoShowSweep, startAppointmentNoShowJob };
