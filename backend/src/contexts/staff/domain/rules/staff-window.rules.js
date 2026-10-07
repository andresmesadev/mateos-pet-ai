const { hasAbsenceOverlap } = require('./availability-resolution.rules');
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function weeklyRows(availability, staffId) {
  return DAYS.flatMap((key, weekday) => availability?.[key]?.active
    ? (availability[key].windows ?? [{ open: availability[key].open, close: availability[key].close }]).map(window => ({ staffId, type: 'base_schedule', weekday, startTime: window.open, endTime: window.close })) : []);
}

function localParts(date, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
  const day = `${p.year}-${p.month}-${p.day}`;
  return { day, weekday: new Date(`${day}T12:00:00Z`).getUTCDay(), time: (+p.hour * 3600 + +p.minute * 60 + +p.second) * 1000 + date.getUTCMilliseconds() };
}

const clockMs = time => { const [hour, minute] = time.split(':').map(Number); return (hour * 60 + minute) * 60000; };

// Única interpretación de semana + ausencias; independiente de Agenda/Prisma.
function staffWindowReason(staff, rows, rangeStart, rangeEnd, timeZone = 'America/Bogota') {
  if (!staff.active) return 'El profesional está retirado del equipo.';
  const start = new Date(rangeStart), end = new Date(rangeEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return 'El rango de atención no es válido.';
  const a = localParts(start, timeZone), b = localParts(end, timeZone);
  if (a.day !== b.day) return 'La atención debe terminar dentro del horario del mismo día.';
  let base = rows.filter(row => row.type === 'base_schedule');
  if (!base.length && staff.availability != null) base = weeklyRows(staff.availability, staff.id);
  const configured = base.length > 0 || staff.availability != null;
  if (configured && !base.some(row => row.weekday === a.weekday && clockMs(row.startTime) <= a.time && clockMs(row.endTime) >= b.time)) return 'La atención queda fuera del horario del profesional.';
  if (hasAbsenceOverlap(rows.filter(row => row.type !== 'base_schedule'), start, end)) return 'El profesional tiene una ausencia en ese horario.';
  return null;
}

module.exports = { weeklyRows, staffWindowReason };
