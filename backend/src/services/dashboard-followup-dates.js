// Presentation dates use the dashboard's existing Bogotá calendar.
function bogotaDayStart(date = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return new Date(`${day}T00:00:00-05:00`);
}
function followupDates(period, now = new Date()) {
  const start = bogotaDayStart(now);
  const tomorrow = new Date(start.getTime() + 86400000);
  if (period === 'past') return { lt: start };
  if (period === 'today') return { gte: start, lt: tomorrow };
  if (period === 'next7') return { gte: tomorrow, lt: new Date(start.getTime() + 8 * 86400000) };
  return undefined;
}
function parseContactDay(value) {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(new Error('La fecha de contacto no es válida.'), { status: 400 });
  const date = new Date(`${value}T00:00:00-05:00`);
  if (!Number.isFinite(date.getTime()) || bogotaDayStart(date).getTime() !== date.getTime()) throw Object.assign(new Error('La fecha de contacto no es válida.'), { status: 400 });
  const actual = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  if (actual !== value) throw Object.assign(new Error('La fecha de contacto no es válida.'), { status: 400 });
  return date;
}
module.exports = { bogotaDayStart, followupDates, parseContactDay };
