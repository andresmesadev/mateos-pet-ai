const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseContactsCSV, normalizeImportSpecies } = require("../frontend/lib/contact-import.ts");
const { normalizeImportSpecies: serverSpecies } = require("../backend/src/services/contact-import-species.js");

function csv(headers, rows, separator = ",") {
  const quote = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
  return "\uFEFF" + [headers, ...rows].map(row => row.map(quote).join(separator)).join("\r\n");
}

test("cada mascota conserva su especie independiente en las cinco posiciones", () => {
  const headers = ["owner_name", ...[1, 2, 3, 4, 5].flatMap(n => [`pet_${n}_name`, `pet_${n}_type`])];
  const result = parseContactsCSV(csv(headers, [["Ana", "Toby", "Perro", "Luna", "FELINOS", "Milo", "cat", "Coco", "dog", "Nube", "Otro"]]));
  assert.deepEqual(result[0].pets.map(pet => pet.type), ["dog", "cat", "cat", "dog", "other"]);
});

test("las variantes españolas e inglesas se normalizan igual en navegador y servidor", () => {
  for (const word of ["dog", "dogs", "perro", "perros", "perra", "perras", "canino", "caninos", "canina", "caninas", "cat", "cats", "gato", "gatos", "gata", "gatas", "felino", "felinos", "felina", "felinas", "other", "otro", "otra", "otros", "otras"]) {
    const raw = ` ${word.toUpperCase()} `;
    assert.ok(normalizeImportSpecies(raw));
    assert.equal(normalizeImportSpecies(raw), serverSpecies(raw));
  }
});

test("un archivo antiguo o una especie desconocida requiere selección, sin asumir perro por raza o nombre", () => {
  const old = parseContactsCSV("owner_name,pet_1_name,pet_1_breed\nAna,Luna,Persa");
  assert.equal(old[0].pets[0].type, "");
  const unknown = parseContactsCSV("pet_1_name,pet_1_type\nLuna,no-se");
  assert.equal(unknown[0].pets[0].type, "no-se");
  assert.equal(normalizeImportSpecies(unknown[0].pets[0].type), null);
});

test("admite nombres alternativos de la columna de especie y rechaza especies contradictorias", () => {
  for (const header of ["pet_1_species", "pet_1_especie"]) {
    assert.equal(parseContactsCSV(`pet_1_name,${header}\nLuna,gata`)[0].pets[0].type, "cat");
  }
  assert.throws(() => parseContactsCSV("pet_1_name,pet_1_type,pet_1_species\nLuna,dog,cat"), /especies diferentes/);
  assert.equal(parseContactsCSV("pet_1_name,pet_1_type,pet_1_species\nLuna,gato,cat")[0].pets[0].type, "cat");
});

test("conserva notas con comillas, saltos de línea y separadores en CSV de coma o punto y coma", () => {
  const notes = 'Cliente dice "gato, tranquilo";\r\nsegunda línea.';
  for (const separator of [",", ";"]) {
    const value = parseContactsCSV(csv(["owner_name", "notes", "pet_1_name", "pet_1_type", "pet_1_last_visit", "pet_1_visit_history"], [["Ana", notes, "Luna", "cat", "2026-10-01", "2026-09-01 | 2026-10-01"]], separator));
    assert.equal(value.length, 1); assert.equal(value[0].notes, notes);
    assert.equal(value[0].pets[0].last_visit, "2026-10-01");
    assert.equal(value[0].pets[0].visit_history, "2026-09-01 | 2026-10-01");
  }
});

test("un grupo de mascotas se mantiene sin dividir nombres ni multiplicar precio o visitas", () => {
  const result = parseContactsCSV("pet_1_name,pet_1_type,pet_1_price\nMia y Amy y Max,perro,70000");
  assert.equal(result[0].pets.length, 1);
  assert.equal(result[0].pets[0].name, "Mia y Amy y Max");
  assert.equal(result[0].pets[0].price, "70000");
});

test('importa precio en centro y total con domicilio sin confundirlos ni calcular otro cargo', () => {
  const result = parseContactsCSV('pet_1_name,pet_1_type,pet_1_price,pet_1_with_transport_price\nLuna,gato,95000,103000');
  assert.equal(result[0].pets[0].price, '95000');
  assert.equal(result[0].pets[0].with_transport_price, '103000');
});

test("rechaza CSV roto en vez de desplazar silenciosamente la columna de especie", () => {
  assert.throws(() => parseContactsCSV('pet_1_name,pet_1_type\n"Luna,cat'), /comillas sin cerrar/);
  assert.throws(() => parseContactsCSV("pet_1_name,pet_1_type\nLuna,cat,dato-extra"), /cantidad de columnas/);
  assert.deepEqual(parseContactsCSV("nombre,especie\nLuna,gato"), []);
});
