const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(path.join(__dirname, "../frontend/lib/contact-navigation.ts"), "utf8");
const context = { exports: {}, URLSearchParams };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { consultationHref, ownerAgendaHref, filterOwnerAppointments } = context.exports;

test("El enlace clínico conserva la cita exacta y su día en Bogotá, aunque pertenezca a otro año", () => {
  const url = new URL(consultationHref({ id: "consulta & anterior", date: "2025-01-01T02:30:00Z" }, "tenant & dos"), "http://localhost");
  assert.equal(url.pathname, "/dashboard/consultas");
  assert.equal(url.searchParams.get("appointment"), "consulta & anterior");
  assert.equal(url.searchParams.get("date"), "2024-12-31");
  assert.equal(url.searchParams.get("tenant"), "tenant & dos");
});

test("La agenda conserva la identidad exacta del propietario y el establecimiento", () => {
  const url = new URL(ownerAgendaHref("cliente & dos", "tenant & dos", "2026-09-30T02:00:00Z"), "http://localhost");
  assert.equal(url.searchParams.get("client"), "cliente & dos");
  assert.equal(url.searchParams.get("tenant"), "tenant & dos");
  assert.equal(url.searchParams.get("date"), "2026-09-29");
  assert(!new URL(ownerAgendaHref("cliente", null, "fecha inválida"), "http://localhost").searchParams.has("date"));
});

test("Dos propietarios con el mismo nombre y teléfono no mezclan sus citas", () => {
  const appointments = [
    { id: "one", userId: "owner-a", clientName: "Ana", clientPhone: "123" },
    { id: "two", userId: "owner-b", clientName: "Ana", clientPhone: "123" },
    { id: "missing", clientName: "Ana", clientPhone: "123" },
  ];
  assert.equal(filterOwnerAppointments(appointments, "owner-b").map((item) => item.id).join(), "two");
  assert.equal(filterOwnerAppointments(appointments, "other").length, 0);
  assert.equal(filterOwnerAppointments(appointments).length, 3);
});
