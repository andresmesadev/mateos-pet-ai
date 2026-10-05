// Disposable POS fixtures and HTTP verification. Refuses any non-local database.
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
require(path.join(root, "backend/node_modules/dotenv")).config({ path: path.join(root, "backend/.env"), override: true, quiet: true });
const database = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) && database.pathname === "/mateos_dev", "Docker local mateos_dev required");
const prisma = require(path.join(root, "backend/src/lib/prisma"));
const { hashPassword } = require(path.join(root, "backend/src/services/staff-credential.service"));
const prefix = "local-pos-workspace-check-";
const tenantId = process.env.SINGLE_TENANT_ID;
assert(tenantId, "Local tenant required");
const where = { tenantId, id: { startsWith: prefix } };
const transactions = { tenantId, OR: [{ id: { startsWith: prefix } }, { userId: prefix + "owner" }] };
async function cleanup() {
  await prisma.transactionItem.deleteMany({ where: { transaction: transactions } });
  await prisma.transaction.deleteMany({ where: transactions });
  await prisma.appointment.deleteMany({ where });
  await prisma.pet.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.staffCredential.deleteMany({ where: { staff: where } });
  await prisma.staff.deleteMany({ where });
  await prisma.service.deleteMany({ where });
  for (const model of ["staff", "user", "pet", "appointment", "service"]) assert.equal(await prisma[model].count({ where }), 0, model + " fixture remains");
  assert.equal(await prisma.transaction.count({ where: transactions }), 0, "POS sale fixture remains");
  console.log("Disposable local POS fixtures removed");
}
async function seed() {
  assert.equal(await prisma.staff.count({ where }), 0, "Clean previous POS fixtures first");
  const passwordHash = await hashPassword("Local-POS-check-2026!");
  for (const role of ["admin", "receptionist"]) await prisma.staff.create({ data: { id: prefix + role, tenantId, role, name: "Prueba POS " + role, generatesCommission: false, credential: { create: { email: prefix + role + "@example.invalid", passwordHash } } } });
  const category = await prisma.serviceCategory.findFirstOrThrow({ where: { tenantId, name: "grooming" } });
  await prisma.service.create({ data: { id: prefix + "service", tenantId, categoryId: category.id, name: "Servicio de prueba POS", duration: 30, basePrice: 42000 } });
  await prisma.user.create({ data: { id: prefix + "owner", tenantId, phone: prefix + "phone", name: "Cliente Prueba POS" } });
  await prisma.pet.create({ data: { id: prefix + "pet", tenantId, ownerId: prefix + "owner", name: "Mascota Prueba POS", type: "dog" } });
  await prisma.appointment.create({ data: { id: prefix + "appointment", tenantId, userId: prefix + "owner", petId: prefix + "pet", petName: "Mascota Prueba POS", petType: "dog", serviceId: prefix + "service", serviceType: "grooming", date: new Date(), status: "completed", finalPrice: 42000 } });
  await prisma.transaction.create({ data: { id: prefix + "system-charge", tenantId, userId: prefix + "owner", petId: prefix + "pet", appointmentId: prefix + "appointment", total: 42000, paymentMethod: "cash", origin: "system_appointment_completed", items: { create: { description: "Servicio de prueba POS", itemKind: "service", quantity: 1, unitPrice: 42000, total: 42000 } } } });
  console.log("Disposable POS fixtures ready (administrator/receptionist, owner, pet, system charge)");
}
async function call(role, url, method = "GET", body) {
  const response = await fetch("http://localhost:3000/api/dashboard" + url, { method, headers: { "content-type": "application/json", "x-internal-token": process.env.INTERNAL_API_SECRET, "x-tenant-id": tenantId, "x-staff-id": prefix + role, "x-staff-session-version": "1" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function verify() {
  const receptionScope = await call("receptionist", "/cash/context");
  const adminScope = await call("admin", "/cash/context");
  assert.equal(receptionScope.status, 200); assert.equal(adminScope.status, 200);
  assert.notEqual(receptionScope.body.draftScope, adminScope.body.draftScope);
  const catalogue = await call("receptionist", "/cash/catalog?petId=" + prefix + "pet");
  assert.equal(catalogue.status, 200);
  assert.equal(catalogue.body.find(service => service.id === prefix + "service").price, 42000);
  for (const role of ["admin", "receptionist"]) {
    const cash = await call(role, "/cash/operational");
    assert.equal(cash.status, 200);
    assert(cash.body.transactions.some(transaction => transaction.id === prefix + "system-charge"));
  }
  const items = [{ description: "Prueba de venta POS", itemKind: "service", quantity: 3, unitPrice: 12345.67 }];
  const sale = await call("receptionist", "/transactions", "POST", { userId: prefix + "owner", petId: prefix + "pet", paymentMethod: "transfer", items });
  assert.equal(sale.status, 201); assert.equal(sale.body.total, 37037.01); assert.equal(sale.body.items[0].total, 37037.01); assert.equal(sale.body.recordedBy.id, "staff:" + prefix + "receptionist");
  assert.equal((await call("receptionist", "/transactions/" + sale.body.id)).body.id, sale.body.id);
  const before = await prisma.transaction.count({ where: { tenantId, appointmentId: prefix + "appointment" } });
  const settled = await call("admin", "/transactions/" + prefix + "system-charge/settle", "POST", { paymentMethod: "card", notes: "Revisión local POS" });
  assert.equal(settled.status, 200); assert.equal(settled.body.total, 42000); assert.equal(settled.body.recordedBy.id, "staff:" + prefix + "admin");
  assert.equal(await prisma.transaction.count({ where: { tenantId, appointmentId: prefix + "appointment" } }), before);
  assert(!(await call("receptionist", "/cash/operational")).body.toReview.includes(prefix + "system-charge"));
  assert.equal((await call("receptionist", "/metrics/cashbox")).status, 403);
  assert.equal((await call("receptionist", "/transactions/" + sale.body.id + "/void", "POST", { reason: "Verificación local" })).status, 403);
  const voided = await call("admin", "/transactions/" + sale.body.id + "/void", "POST", { reason: "Verificación local: venta de prueba" });
  assert.equal(voided.status, 200); assert.equal(voided.body.status, "voided"); assert.equal(voided.body.total, sale.body.total);
  assert.equal(voided.body.items[0].total, sale.body.items[0].total); assert.equal(voided.body.voidReason, "Verificación local: venta de prueba");
  assert.equal((await call("admin", "/transactions/" + sale.body.id)).body.status, "voided");
  assert.equal((await call("admin", "/transactions/" + prefix + "system-charge/void", "POST", { reason: "No permitido" })).status, 422);
  assert(!(await call("receptionist", "/cash/operational")).body.transactions.some(transaction => transaction.id === sale.body.id));
  console.log("PASS: persisted sale totals/items/actor; receipt read; administrator settlement; unchanged system amount/count; operational review updated; receptionist financial privacy");
  console.log("PASS: authenticated draft contexts; resolved catalogue price; receptionist void denied; administrator void retained original amount/items/reason; system charge protected; void excluded from operational income");
}
async function run() {
  if (process.argv.includes("--cleanup")) return cleanup();
  if (process.argv.includes("--seed")) return seed();
  if (process.argv.includes("--verify")) return verify();
  if (process.argv.includes("--reset-review")) {
    await prisma.transaction.update({ where: { id: prefix + "system-charge", tenantId }, data: { recordedActorId: null, recordedActorName: null, recordedActorRole: null, notes: null, paymentMethod: "cash" } });
    console.log("Synthetic system charge ready for browser review");
    return;
  }
  throw new Error("Use --seed, --verify or --cleanup; all operations are local only");
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
