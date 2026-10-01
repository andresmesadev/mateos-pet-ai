const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(path.join(__dirname, "../frontend/lib/contact-profile-utils.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { formatPetAge, matchesHistory, groupClientAppointments } = context.exports;
const petsSource = fs.readFileSync(path.join(__dirname, "../frontend/lib/pets.ts"), "utf8");
const petsContext = { exports: {} };
vm.runInNewContext(ts.transpileModule(petsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, petsContext);
test("Las fechas de aplicación conservan su día; las citas conservan su zona horaria", () => {
  assert.equal(petsContext.exports.formatRecordDate("2026-09-30T00:00:00.000Z", true), "30/09/2026");
  assert.equal(petsContext.exports.formatRecordDate("2026-09-30T00:00:00.000Z"), "29/09/2026");
  assert.equal(petsContext.exports.formatRecordDate("2026-09-30"), "30/09/2026");
});
const now = new Date("2026-10-01T00:30:00Z"); // Sigue siendo 30 de septiembre en Bogotá.
test("La edad usa el cumpleaños en Bogotá, sin adelantar un día por UTC", () => {
  assert.equal(formatPetAge("2025-09-30", now), "1 año");
  assert.equal(formatPetAge("2025-10-01", now), "11 meses");
  assert.equal(formatPetAge("2026-09-29", now), "Menos de 1 mes");
});
test("No inventa edades con fechas faltantes, futuras o imposibles", () => {
  assert.equal(formatPetAge(null, now), "Sin fecha de nacimiento");
  assert.equal(formatPetAge("2026-10-01", now), "Revisar fecha de nacimiento");
  assert.equal(formatPetAge("2025-02-30", now), "Revisar fecha de nacimiento");
});
const item = { kind: "consultation", title: "Control de piel", diagnosis: "Reacción cutánea", staffName: "Lina María", date: "2025-09-01" };
test("Encuentra términos combinados sin exigir acentos y busca en diagnóstico y profesional", () => {
  assert(matchesHistory(item, "consultation", "reaccion maria"));
  assert(matchesHistory(item, "all", "2025 piel"));
  assert(!matchesHistory(item, "consultation", "reaccion vacuna"));
});
test("El tipo seleccionado y el texto se aplican juntos", () => {
  assert(!matchesHistory(item, "vaccine", "piel"));
  assert(matchesHistory({ kind: "note", title: "Baño histórico" }, "note", "bano"));
  assert(!matchesHistory(item, "note", ""));
  assert(matchesHistory({ kind: "no_show", serviceType: "bath_grooming", title: "Baño básico" }, "grooming", "bano"));
});
test("Una cita vencida o en atención no se presenta como visita cerrada", () => {
  const rows = [
    { id: "past", date: "2026-09-29T13:00:00Z", status: "confirmed" },
    { id: "arrived", date: "2026-10-02T13:00:00Z", status: "arrived" },
    { id: "done", date: "2026-09-29T13:00:00Z", status: "completed" },
    { id: "cancel", date: "2026-10-02T13:00:00Z", status: "cancelled" },
    { id: "future", date: "2026-10-02T13:00:00Z", status: "confirmed" },
  ];
  const result = groupClientAppointments(rows, now.getTime());
  assert.equal(result.upcoming.map((row) => row.id).join(), "future");
  assert.equal(result.pending.map((row) => row.id).join(), "past,arrived");
  assert.equal(result.previous.map((row) => row.id).join(), "cancel,done");
});
