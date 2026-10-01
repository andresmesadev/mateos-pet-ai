const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const context = { exports: {}, Intl, Map, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../frontend/lib/whatsapp-workspace.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
const { mergeThreadMessages, uniqueThreads, messageDay, matchingMessageIds, threadDateLabel, messageAuthorLabel } = context.exports;
test("una actualización tardía no duplica ni elimina la respuesta recién enviada", () => {
  const old = { id: "old", createdAt: "2026-09-30T12:00:00Z", content: "Antes" }, sent = { id: "sent", createdAt: "2026-09-30T12:01:00Z", content: "Después" };
  assert.equal(mergeThreadMessages([old, sent], [old]).map((row) => row.id).join(), "old,sent");
  assert.equal(mergeThreadMessages([old, sent], [old, sent]).length, 2);
});
test("las páginas superpuestas mantienen una sola fila por propietario y la sesión más reciente", () => {
  const current = { id: "new", userId: "ana", updatedAt: "2026-09-30T12:00:00Z" };
  const old = { id: "old", userId: "ana", updatedAt: "2026-09-29T12:00:00Z" };
  assert.equal(uniqueThreads([current, old]).map((row) => row.id).join(), "new");
  assert.equal(uniqueThreads([old, current]).map((row) => row.id).join(), "new");
});
test("el separador usa el día de Bogotá al cruzar la medianoche UTC", () => {
  assert.match(messageDay("2026-10-01T02:00:00Z"), /30 de septiembre de 2026/);
});

test("la búsqueda encuentra tildes, mayúsculas y saltos de línea sin mezclar mensajes", () => {
  const rows = [{id:"luna", content:"Revisión de Luna\nmañana"}, {id:"milo", content:"Baño de Milo"}];
  assert.equal(matchingMessageIds(rows, " REVISION ").join(), "luna");
  assert.equal(matchingMessageIds(rows, "MILO").join(), "milo");
  assert.equal(matchingMessageIds(rows, "   ").length, 0);
  assert.equal(matchingMessageIds(rows, "otro paciente").length, 0);
});

test("Hoy y Ayer se calculan por el día de Bogotá", () => {
  const now = new Date("2026-10-01T02:00:00Z");
  assert.equal(threadDateLabel("2026-09-30T15:00:00Z", now), "Hoy");
  assert.equal(threadDateLabel("2026-09-29T15:00:00Z", now), "Ayer");
  assert.equal(threadDateLabel(null, now), "");
  assert.equal(threadDateLabel("incorrecto", now), "");
  assert.match(threadDateLabel("2025-06-05T15:00:00Z", now), /2025/);
});
test("los autores reales se distinguen y el histórico no se atribuye retroactivamente a la IA",()=>{
  assert.equal(messageAuthorLabel({role:"assistant",origin:"agente"}),"Saliente histórico · Autor no registrado");
  assert.equal(messageAuthorLabel({role:"assistant",senderKind:"human",senderName:"Dra. Ana"}),"Dra. Ana · Equipo");
  assert.equal(messageAuthorLabel({role:"assistant",senderKind:"ai"}),"Asistente IA");
  assert.equal(messageAuthorLabel({role:"assistant",senderKind:"system"}),"Sistema");
  assert.equal(messageAuthorLabel({role:"user"}),"Cliente");
});
