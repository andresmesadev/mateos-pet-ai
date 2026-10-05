const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
function load(name) {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../frontend/lib/" + name + ".ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const { readDraft, draftKey, clearSaleDrafts, readStoredDraft, writeStoredDraft, removeStoredDraft, pendingSaleKey } = load("pos-draft");
const { validHistoryRange, filterTransactions, canVoidSale } = load("pos-history");
const now = Date.now();
const draft = { version: 1, scope: "scope-a", updatedAt: now, stage: "preparing", lines: [{ id: "line", description: "Corte", quantity: "1", unitPrice: "55000", itemKind: "service" }], client: null, petId: "", paymentMethod: "cash", received: "100000", notes: "" };
const read = (changes = {}, scope = "scope-a", at = now) => readDraft(JSON.stringify({ ...draft, ...changes }), scope, at);

test("El borrador conserva el origen de la tarifa y rechaza metadatos incompletos", () => {
  const serviceQuote = { source: "pet", petId: "pet-a", petName: "Luna", unitPrice: "55000", description: "Corte" };
  const lines = [{ ...draft.lines[0], serviceQuote }];
  const restored = read({ lines });
  assert.equal(restored.lines[0].serviceQuote.petId, "pet-a");
  assert.equal(restored.lines[0].serviceQuote.unitPrice, "55000");
  assert.equal(read({ lines: [{ ...lines[0], serviceQuote: null }] }), null);
  assert.equal(read({ lines: [{ ...lines[0], serviceQuote: { ...serviceQuote, source: "invented" } }] }), null);
  assert.equal(read({ lines: [{ ...lines[0], serviceQuote: { ...serviceQuote, petName: undefined } }] }), null);
  assert.equal(read({ lines: [{ ...lines[0], serviceQuote: { ...serviceQuote, description: "x".repeat(251) } }] }), null);
  assert.equal(read().lines[0].serviceQuote, undefined);
});
test("draft recovery isolates contexts and expires unsubmitted preparation after twelve hours", () => {
  assert(read()); assert.equal(read({}, "scope-b"), null);
  assert.notEqual(draftKey("scope-a"), draftKey("scope-b"));
  assert.equal(read({}, "scope-a", now + 13 * 3600000), null);
  assert.equal(read({ updatedAt: now + 120000 }), null);
});
test("in-flight/uncertain sale stays marked for verification even after the normal draft expiry", () => {
  assert.equal(read({ stage: "verify" }, "scope-a", now + 13 * 3600000).stage, "verify");
  assert.equal(read({ stage: "confirmed" }), null);
});
test("uncertain catalogue sale preserves operation key, SKU and historical price version", () => {
  const operationKey="11111111-2222-4333-8444-555555555555";
  const lines=[{id:"line",description:"Frasco",quantity:"2",unitPrice:"12000",itemKind:"product",productId:"sku-1",priceVersion:3,presentation:"Frasco 100 ml"}];
  const restored=read({stage:"verify",operationKey,lines},"scope-a",now+365*24*3600000);
  assert.equal(restored.operationKey,operationKey);assert.equal(restored.lines[0].productId,"sku-1");assert.equal(restored.lines[0].priceVersion,3);
  assert.equal(read({operationKey:"not-a-key"}),null);
  assert.equal(read({lines:[{...lines[0],priceVersion:undefined}]}),null);
});
test("sign-out clears only POS drafts to protect a shared workstation", () => {
  const values = new Map([[draftKey("a"), "draft-a"], [draftKey("b"), "draft-b"], ["other-data", "keep"]]);
  clearSaleDrafts({ get length() { return values.size; }, key: index => [...values.keys()][index], removeItem: key => values.delete(key) });
  assert.deepEqual([...values.keys()], ["other-data"]);
});
test("uncertain sales survive closing the tab and sign-out, isolated by account", () => {
  function storage() { const values = new Map(); return { get length() { return values.size; }, key: i => [...values.keys()][i], getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }; }
  const session = storage(), durable = storage();
  const pending = { ...draft, stage: "verify", operationKey: "11111111-2222-4333-8444-555555555555", operationBody: '{"items":[{"productId":"sku"}]}' };
  writeStoredDraft(session, durable, pending);
  clearSaleDrafts(session);
  assert.equal(readStoredDraft(storage(), durable, "scope-a").operationBody, pending.operationBody);
  assert.equal(readStoredDraft(storage(), durable, "scope-b"), null);
  assert.throws(() => writeStoredDraft(session, durable, draft), /pendiente/);
  removeStoredDraft(session, durable, "scope-a");
  assert.equal(durable.getItem(pendingSaleKey("scope-a")), null);
  assert.equal(readStoredDraft(session, durable, "scope-a"), null);
});
test("legacy in-flight key migrates from temporary to durable storage", () => {
  const pending = { ...draft, stage: "verify", operationKey: "11111111-2222-4333-8444-555555555555" };
  const temporary = { getItem: () => JSON.stringify(pending) };
  const saved = new Map();
  const durable = { getItem: k => saved.get(k) ?? null, setItem: (k,v) => saved.set(k,v) };
  assert.equal(readStoredDraft(temporary, durable, "scope-a").operationKey, pending.operationKey);
  assert.equal(readStoredDraft({getItem: () => null}, durable, "scope-a").operationKey, pending.operationKey);
});
test("corrupt or oversized drafts cannot restore stale owner/pet associations", () => {
  assert.equal(readDraft("{", "scope-a"), null);
  assert.equal(read({ petId: "foreign" }), null);
  assert.equal(read({ lines: [null] }), null);
  assert.equal(read({ lines: Array(101).fill(draft.lines[0]) }), null);
  assert.equal(read({ notes: "x".repeat(2001) }), null);
  assert.equal(read({ client: { id: "owner", name: "Ana", phone: "123", pets: [{ id: "pet", name: "Luna", type: "cat" }] }, petId: "pet" }).petId, "pet");
});
test("history accepts real calendar dates and rejects inverted or impossible ranges", () => {
  assert(validHistoryRange("2024-02-29", "2024-03-01"));
  for (const [a, b] of [["2026-02-29", "2026-03-01"], ["2026-10-03", "2026-10-02"], ["", "2026-10-02"], ["2026-13-01", "2026-13-31"]]) assert.equal(validHistoryRange(a, b), false);
});
const rows = [{ id: "sale-a", clientName: "Andrés Pérez", petName: "Luna", paymentMethod: "cash", status: "active", origin: "manual_pos_sale", items: [{ description: "Baño básico" }] }, { id: "sale-b", clientPhone: "3001234", petName: "Milo", paymentMethod: "card", status: "voided", origin: "manual_pos_sale", items: [{ description: "Consulta" }] }];
test("history filters owner accents, pet, telephone, article, method and void status", () => {
  for (const query of ["andres", "Luna", "bano", "sale-a"]) assert.equal(filterTransactions(rows, query, "all", "all")[0].id, "sale-a");
  assert.equal(filterTransactions(rows, "3001234", "card", "voided")[0].id, "sale-b");
  assert.equal(filterTransactions(rows, "Milo", "cash", "all").length, 0);
});
test("void action applies only to active manual sales for administrators", () => {
  assert(canVoidSale(rows[0], true));
  assert.equal(canVoidSale(rows[0], false), false);
  assert.equal(canVoidSale(rows[1], true), false);
  assert.equal(canVoidSale({ ...rows[0], origin: "system_appointment_completed" }, true), false);
});
