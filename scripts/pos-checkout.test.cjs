const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(path.join(__dirname, "../frontend/lib/pos-checkout.ts"), "utf8");
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { moneyInCents, validateCheckout, lineTotalCents, cashChange, addCheckoutLine, catalogueLineIssue, productQuantities, checkoutPriceLabel } = context.exports;
const line = (values = {}) => ({ id: "a", description: "Corte de uñas", quantity: "1", unitPrice: "55000", itemKind: "service", ...values });
const both = { services: true, retail: true };

test("La tarifa distingue catálogo, mascota y edición sin cambiar importes", () => {
  const serviceQuote = { source: "pet", petId: "pet-a", petName: "Luna", unitPrice: "55000", description: "Corte de uñas" };
  const quoted = line({ serviceQuote });
  assert.equal(checkoutPriceLabel(quoted), "Tarifa de Luna");
  assert.equal(checkoutPriceLabel({ ...quoted, unitPrice: "55000,00" }), "Tarifa de Luna");
  assert.equal(checkoutPriceLabel({ ...quoted, unitPrice: "60000" }), "Precio editado");
  assert.equal(checkoutPriceLabel({ ...quoted, description: "Otro servicio" }), "Precio editado");
  assert.equal(checkoutPriceLabel(line()), "Precio ingresado");
  assert.equal(checkoutPriceLabel(line({ serviceQuote: { ...serviceQuote, source: "catalog" } })), "Precio del catálogo");
  assert.equal(quoted.unitPrice, "55000");
});

test("Importes exactos con dos decimales y límites de persistencia", () => {
  assert.equal(moneyInCents("55000"), 5500000);
  assert.equal(moneyInCents("0,29"), 29);
  assert.equal(moneyInCents("99999999.99"), 9999999999);
  for (const value of ["100000000", "NaN", "Infinity", "-2", "55.000", "55,000", "1e3", "", "1.001"]) assert.equal(moneyInCents(value), null, value);
});
test("No descarta renglones incompletos ni cobra una cantidad inválida", () => {
  assert.match(validateCheckout([line(), line({ description: "" })], both), /Artículo 2/);
  assert.match(validateCheckout([line({ unitPrice: "" })], both), /precio/);
  for (const quantity of ["0", "-1", "1.5", "", "1e2", "9007199254740993"]) assert.match(validateCheckout([line({ quantity })], both), /cantidad/);
  assert.equal(validateCheckout([line(), line({ itemKind: "product", quantity: "2" })], both), null);
});
test("La suma de renglones no puede exceder el máximo del backend", () => {
  assert.match(validateCheckout([line({ unitPrice: "99999999.99" }), line()], both), /límite/);
  assert.match(validateCheckout([line({ unitPrice: "50000000", quantity: "2" })], both), /límite/);
  assert.equal(lineTotalCents(line({ unitPrice: "0.29", quantity: "3" })), 87);
});
test("Los módulos habilitados limitan el tipo de artículo", () => {
  assert.match(validateCheckout([line({ itemKind: "product" })], { services: true, retail: false }), /habilitado/);
  assert.match(validateCheckout([line()], { services: false, retail: true }), /habilitado/);
  assert.match(validateCheckout([line({ itemKind: "legacy" })], both), /habilitado/);
});
test("El efectivo permite valor exacto, cambio y saldo insuficiente sin errores de decimales", () => {
  assert.equal(cashChange(5500000, "100000").change, 45000);
  assert.equal(cashChange(5500000, "55000").change, 0);
  assert.equal(cashChange(5500000, "50000").missing, 5000);
  assert.equal(cashChange(87, "1").change, 0.13);
  assert.equal(cashChange(5500000, ""), null);
});

test("Escanear de nuevo suma el mismo SKU conservando fila y precio; artículos manuales no se fusionan", () => {
  const product = line({ itemKind: "product", productId: "sku-a", priceVersion: 1, quantity: "2" });
  const result = addCheckoutLine([product], { ...product, id: "scan-2", quantity: "1" });
  assert.equal(result.error, null);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].id, "a");
  assert.equal(result.lines[0].quantity, "3");
  assert.equal(result.lines[0].unitPrice, "55000");
  assert.equal(addCheckoutLine([line()], line({ id: "manual-2" })).lines.length, 2);
});

test("El escaneo no cambia precios ni oculta cantidades inválidas o fuera del límite", () => {
  const product = line({ itemKind: "product", productId: "sku-a", priceVersion: 1 });
  for (const change of [{ priceVersion: 2 }, { unitPrice: "66000" }, { quantity: "0" }, { quantity: "2147483647" }]) {
    const result = addCheckoutLine([product], { ...product, id: "scan-2", ...change });
    assert.ok(result.error);
    assert.equal(result.lines[0].quantity, "1");
    assert.equal(result.lines[0].priceVersion, 1);
  }
  assert.match(validateCheckout([line({ quantity: "2147483648" })], both), /cantidad/);
});

test("Los avisos revisan stock agregado, precio y desactivación del producto correspondiente", () => {
  const product = line({ itemKind: "product", productId: "sku-a", priceVersion: 1 });
  const snapshot = { id: "sku-a", name: "Champú", active: true, uses: ["retail"], available: "3", salePrice: 55000, priceVersion: 1, presentation: "Frasco", internalCode: "A" };
  assert.equal(catalogueLineIssue(product, snapshot, 3), null);
  assert.match(catalogueLineIssue(product, snapshot, 4), /Solo hay 3/);
  assert.match(catalogueLineIssue(product, { ...snapshot, available: "0" }, 1), /Solo hay 0/);
  assert.match(catalogueLineIssue(product, { ...snapshot, priceVersion: 2 }, 1), /precio/);
  assert.match(catalogueLineIssue(product, { ...snapshot, active: false }, 1), /habilitado/);
  assert.match(catalogueLineIssue(product, { ...snapshot, uses: ["veterinary"] }, 1), /habilitado/);
  assert.equal(productQuantities([product, { ...product, id: "old-draft", quantity: "2" }])["sku-a"], 3);
});
