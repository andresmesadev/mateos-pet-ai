/**
 * Corrige números de fijo Medellín mal importados.
 *
 * Patrón erróneo: 576XXXXXXXXX (12 dígitos) — el 57 es prefijo Colombia
 *                 que no corresponde a números fijos; solo aplica a celulares.
 * Corrección:     604XXXXXXX  (10 dígitos) — quitar el 57 del prefijo
 *
 * Regla permanente: los números 604XXXXXXX son líneas fijas. NUNCA se les
 * agrega 57 ni +57. Solo los celulares (3XXXXXXXXX) llevan prefijo 57.
 */

const prisma = require("../src/lib/prisma");

async function main() {
  // 1. Encontrar todos los afectados
  const affected = await prisma.user.findMany({
    where: { phone: { startsWith: "576" } },
    select: { id: true, phone: true, name: true },
  });

  // Filtrar solo los que tienen exactamente 12 dígitos (576 + 9)
  const toFix = affected.filter((u) => /^576\d{9}$/.test(u.phone));

  if (toFix.length === 0) {
    console.log("No se encontraron números 576XXXXXXXXX. Nada que corregir.");
    return;
  }

  console.log(`Encontrados ${toFix.length} números a corregir:`);
  toFix.slice(0, 5).forEach((u) =>
    console.log(`  ${u.phone} → ${u.phone.slice(2)}  (${u.name ?? "Sin nombre"})`)
  );
  if (toFix.length > 5) console.log(`  ... y ${toFix.length - 5} más`);

  // 2. Verificar colisiones — el número corregido no debe existir ya en BD
  const corrected = toFix.map((u) => u.phone.slice(2));
  const existing = await prisma.user.findMany({
    where: { phone: { in: corrected } },
    select: { phone: true },
  });
  const collisionSet = new Set(existing.map((u) => u.phone));

  const safe   = toFix.filter((u) => !collisionSet.has(u.phone.slice(2)));
  const unsafe = toFix.filter((u) =>  collisionSet.has(u.phone.slice(2)));

  if (unsafe.length > 0) {
    console.warn(`\n⚠  ${unsafe.length} número(s) no se pueden corregir porque ya existe un registro con el número destino:`);
    unsafe.forEach((u) => console.warn(`  ${u.phone} → ${u.phone.slice(2)} [COLISIÓN — se omite]`));
  }

  if (safe.length === 0) {
    console.log("\nNada que actualizar sin colisión.");
    return;
  }

  // 3. Actualizar en lote
  let updated = 0;
  for (const u of safe) {
    await prisma.user.update({
      where: { id: u.id },
      data:  { phone: u.phone.slice(2) },
    });
    updated++;
  }

  console.log(`\n✓ ${updated} número(s) corregidos correctamente.`);
  if (unsafe.length > 0) {
    console.log(`  ${unsafe.length} omitido(s) por colisión — requieren revisión manual.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
