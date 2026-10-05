const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(path.join(__dirname, "../frontend/lib/inventory-display.ts"), "utf8");
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { stockPreview, stockLabel, inventoryDate } = context.exports;

test("Una entrada suma unidades físicas sin prometer disponibilidad", () => {
  const preview = stockPreview("entry", "12", "8");
  assert.equal(preview.delta, 12); assert.equal(preview.physicalAfter, "20");
  assert.equal(preview.available, undefined);
});
test("El conteo usa el total del lote, conserva los otros lotes y permite contar cero", () => {
  assert.equal(stockPreview("count", "4", "18", 8).physicalAfter, "14");
  assert.equal(stockPreview("count", "0", "18", 8).delta, -8);
  assert.equal(stockPreview("count", "8", "18", 8).delta, 0);
  assert.equal(stockPreview("count", "12", "18", 8).physicalAfter, "22");
});
test("La vista previa conserva saldos mayores al entero seguro de JavaScript", () => {
  assert.equal(stockPreview("entry", "1", "9007199254740993").physicalAfter, "9007199254740994");
});
test("La corrección respeta la cantidad original sin inferir correcciones anteriores", () => {
  assert.equal(stockPreview("correction", "2", "8", 0, 3).physicalAfter, "10");
  assert.equal(stockPreview("correction", "4", "8", 0, 3), null);
});
test("Cantidades vacías, negativas, fraccionadas y fuera del límite no producen saldo", () => {
  for (const quantity of ["", " ", "-1", "1.5", "1e3", "abc", "2147483648", "0"]) assert.equal(stockPreview("entry", quantity, "8"), null, quantity);
  assert.equal(stockPreview("entry", "2147483647", "8").delta, 2147483647);
});
test("Los estados priorizan desactivado y sin disponibles sobre el mínimo", () => {
  assert.equal(stockLabel({ active: false, available: "0", lowStock: true }).text, "Desactivado");
  assert.equal(stockLabel({ active: true, available: "0", lowStock: false }).text, "Sin disponibles");
  assert.equal(stockLabel({ active: true, available: "3", lowStock: true }).text, "Reponer");
  assert.equal(stockLabel({ active: true, available: "9007199254740993", lowStock: false }).text, "Disponible");
});
test("Una fecha de vencimiento conserva el día en Bogotá", () => {
  assert.match(inventoryDate("2026-10-05"), /^5 /);
  assert.match(inventoryDate("2026-10-05"), /2026/);
});
