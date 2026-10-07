// Validación administrativa; la sincronización se realiza bajo lock (ADRs 011/018).
const DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function staffEditorError(body = {}) {
  const { name, email, phone, active, availability } = body;
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 200)) return "Escribe un nombre de hasta 200 caracteres.";
  if (phone !== undefined && phone !== null && (typeof phone !== "string" || phone.length > 40)) return "Escribe un teléfono de hasta 40 caracteres.";
  if (email !== undefined && email !== null && (typeof email !== "string" || email.length > 254 || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))) return "Escribe un correo válido.";
  if (active !== undefined && typeof active !== "boolean") return "El estado del integrante debe ser activo o inactivo.";
  if (availability === undefined || availability === null) return null;
  if (typeof availability !== "object" || Array.isArray(availability)) return "El horario semanal debe ser un objeto o null.";
  for (const [key, day] of Object.entries(availability)) {
    if (!DAYS.has(key) || !day || typeof day !== "object" || Array.isArray(day) || typeof day.active !== "boolean") return "Revisa los días del horario semanal.";
    if (day.windows !== undefined && (!Array.isArray(day.windows) || day.windows.length > 8)) return "Configura hasta ocho franjas por día.";
    const windows = day.windows ?? [{ open: day.open, close: day.close }];
    if (day.active && !windows.length) return "Agrega al menos una franja para los días de trabajo.";
    if (day.active) {
      for (const window of windows) if (!window || !TIME.test(window.open ?? '') || !TIME.test(window.close ?? '') || window.open >= window.close) return "La entrada debe ser anterior a la salida, con formato HH:mm.";
      const ordered = [...windows].sort((a,b) => a.open.localeCompare(b.open));
      if (ordered.some((window,index) => index > 0 && ordered[index-1].close > window.open)) return "Las franjas del mismo día no pueden superponerse.";
    }
    for (const value of [day.open, day.close]) {
      if (value !== undefined && (typeof value !== "string" || (value !== "" && !TIME.test(value)))) return "Usa horas válidas con formato HH:mm.";
    }
  }
  return null;
}
module.exports = { staffEditorError };
