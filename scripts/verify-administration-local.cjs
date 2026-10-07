// Runs the real profile adapter and production frontend build against a disposable local tenant.
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const root = path.join(__dirname, "..");
require("../backend/node_modules/dotenv").config({ path: path.join(root, "backend/.env"), quiet: true });
require("../backend/node_modules/dotenv").config({ path: path.join(root, "frontend/.env.local"), quiet: true });
const prisma = require("../backend/src/lib/prisma");
const express = require("../backend/node_modules/express");
const { effectiveAccess } = require("../backend/src/services/dashboard-access.service");
const id = "local-administration-ui-verification";
const slug = "local-administration-ui-verification";
const apiPort = 3120;
const uiPort = 3121;

async function removeFixture() {
  await prisma.$transaction(async (tx) => {
    const row = await tx.tenant.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true, services: true, staff: true, appointments: true } } } });
    assert.equal(row.slug, slug);
    const fixtureUsers = await tx.user.findMany({ where: { tenantId: id }, select: { name: true } });
    const fixtureVisits = await tx.appointment.findMany({ where: { tenantId: id }, select: { petName: true } });
    assert(fixtureUsers.every(user => user.name === 'Propietario de prueba') && fixtureVisits.every(visit => visit.petName === 'Mascota de prueba'), 'Unexpected dependent data; refusing cleanup');
    const fixtureStaff = await tx.staff.findMany({ where: { tenantId: id }, select: { id: true, name: true } });
    assert(fixtureStaff.every(member => member.name.startsWith("Integrante de prueba")), "Unexpected member in fixture; refusing cleanup");
    assert.equal(await tx.commission.count({ where: { staff: { tenantId: id } } }), 0);
    const fixtureServices = await tx.service.findMany({ where: { tenantId: id }, select: { id: true, name: true } });
    assert(fixtureServices.every((service) => service.name.startsWith("Servicio de prueba")), "Unexpected service in fixture; refusing cleanup");
    assert.equal(await tx.automationExecution.count({ where: { domainEvent: { tenantId: id } } }), 0);
    await tx.eventDelivery.deleteMany({ where: { domainEvent: { tenantId: id } } });
    await tx.domainEvent.deleteMany({ where: { tenantId: id } });
    await tx.appointment.deleteMany({ where: { tenantId: id } });
    await tx.pet.deleteMany({ where: { tenantId: id } });
    await tx.user.deleteMany({ where: { tenantId: id } });
    await tx.staffAvailability.deleteMany({ where: { staff: { tenantId: id } } });
    await tx.staffCapability.deleteMany({ where: { staff: { tenantId: id } } });
    await tx.staffCredential.deleteMany({ where: { staff: { tenantId: id } } });
    await tx.staff.deleteMany({ where: { tenantId: id } });
    await tx.agendaException.deleteMany({ where: { tenantId: id } });
    await tx.priceRule.deleteMany({ where: { service: { tenantId: id } } });
    await tx.service.deleteMany({ where: { tenantId: id } });
    await tx.serviceCategory.deleteMany({ where: { tenantId: id } });
    await tx.tenant.delete({ where: { id } });
  });
  console.log("PASS: disposable tenant removed; existing business data unchanged.");
}

async function main() {
  const db = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) && db.pathname === "/mateos_dev", "Verification requires mateos_dev on localhost");
  // On Windows some PTY hosts do not deliver SIGINT. Stop the fixture processes
  // before invoking this explicit cleanup mode; the marker and dependencies are checked.
  if (process.argv[2] === "cleanup") {
    await removeFixture();
    await prisma.$disconnect();
    process.exit(0);
  }
  if (process.argv[2] === "cleanup-check") {
    assert.equal(await prisma.tenant.count({ where: { OR: [{ id }, { slug }] } }), 0);
    console.log("PASS: no queda ningún establecimiento temporal de esta comprobación.");
    await prisma.$disconnect();
    process.exit(0);
  }
  if (process.argv[2] === "verify") {
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id } });
    assert.equal(row.name, "Negocio actualizado de prueba");
    assert.equal(row.phone, "000000009940");
    assert.equal(row.contactPhone, "+573001234567");
    assert.equal(row.email, "prueba@example.test");
    assert.equal(row.address, "Calle de prueba 123, Bogotá");
    assert.equal(row.description, "Datos guardados durante la comprobación local.");
    console.log("PASS: nombre, teléfono de contacto, correo, descripción y dirección persistidos; identificador de WhatsApp conservado en PostgreSQL local.");
    await prisma.$disconnect();
    process.exit(0);
  }
  if (process.argv[2] === "verify-areas") {
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id } });
    assert.deepEqual([...row.activeModules].sort(), ["grooming", "retail", "veterinary"]);
    assert.equal(row.phone, "000000009940");
    assert.equal(row.slug, slug);
    console.log("PASS: las tres áreas reactivadas están persistidas en PostgreSQL local; identidad y canal del establecimiento temporal conservados.");
    await prisma.$disconnect();
    process.exit(0);
  }
  if (process.argv[2] === "verify-services") {
    const rows = await prisma.service.findMany({ where: { tenantId: id } });
    const edited = rows.find((row) => row.name === "Servicio de prueba Baño actualizado");
    assert(edited && edited.active);
    assert.equal(edited.duration, 50);
    assert.equal(Number(edited.basePrice), 63000);
    const added = rows.find((row) => row.name === "Servicio de prueba adicional");
    assert(added && added.active);
    assert.equal(Number(added.basePrice), 12000);
    assert.equal(rows.length, 4);
    console.log("PASS: creación, edición, retiro y reactivación comprobados en PostgreSQL local; cuatro servicios temporales conservados.");
    await prisma.$disconnect();
    process.exit(0);
  }
  if (process.argv[2] === "verify-hours") {
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id } });
    assert.deepEqual(row.businessHours.mon, { active: true, open: "09:15", close: "18:20" });
    assert.deepEqual(row.businessHours.services.grooming.tue, { active: true, open: "10:30", close: "15:10" });
    assert.equal(row.businessHours.sun, undefined);
    const special = await prisma.agendaException.findMany({ where: { tenantId: id } });
    assert.equal(special.length, 1);
    assert.equal(special[0].startDate, "2026-12-25");
    assert.equal(special[0].endDate, null);
    assert.equal(special[0].reason, "Jornada especial de prueba");
    assert.equal(special[0].open, "10:30");
    assert.equal(special[0].close, "15:10");
    console.log("PASS: horario habitual, horario propio de peluquería, herencia de días y fecha especial guardados desde la interfaz en PostgreSQL.");
    await prisma.$disconnect();
    process.exit(0);
  }
  if (process.argv[2] === "verify-team") {
    const rows = await prisma.staff.findMany({ where: { tenantId: id } });
    const member = rows.find(row => row.name === "Integrante de prueba Actualizado");
    assert(member && member.active);
    assert.deepEqual(member.availability.mon, { active: true, open: "09:15", close: "15:10" });
    assert(member.accessPermissions.includes("cash"));
    assert(rows.some(row => row.name === "Integrante de prueba Nuevo"));
    console.log("PASS: ficha creada y editada, horario con minutos y permiso de Caja guardados desde el navegador en PostgreSQL.");
    await prisma.$disconnect(); process.exit(0);
  }
  assert.equal(await prisma.tenant.count({ where: { OR: [{ id }, { slug }, { phone: { in: ["000000009940", "000000009941"] } }] } }), 0, "An earlier fixture or phone exists; inspect before starting");
  await prisma.tenant.create({ data: { id, slug, name: "Negocio temporal de Administración", phone: "000000009940", address: "Dirección inicial de prueba", activeModules: ["veterinary", "grooming", "retail"] } });
  if (['team', 'availability'].includes(process.argv[2])) {
    await prisma.tenant.update({ where: { id }, data: { businessHours: { mon: { active: true, open: "10:30", close: "17:10" } } } });
    await prisma.staff.createMany({ data: [
      { tenantId: id, name: "Integrante de prueba María", role: "vet", email: "prueba@example.test" },
      { tenantId: id, name: "Integrante de prueba Recepción", role: "receptionist" },
      { tenantId: id, name: "Integrante de prueba Inactivo", role: "groomer", active: false },
    ] });
  }
  if (process.argv[2] === 'availability') {
    const category = await prisma.serviceCategory.create({ data: { tenantId: id, name: 'veterinary' } });
    const service = await prisma.service.create({ data: { tenantId: id, categoryId: category.id, name: 'Servicio de prueba Consulta', duration: 45, basePrice: 66000 } });
    const user = await prisma.user.create({ data: { tenantId: id, name: 'Propietario de prueba', phone: '000000009942' } });
    const pet = await prisma.pet.create({ data: { tenantId: id, ownerId: user.id, name: 'Mascota de prueba', type: 'dog' } });
    const staff = await prisma.staff.findFirstOrThrow({ where: { tenantId: id, role: 'vet' } });
    await prisma.staff.create({ data: { tenantId: id, name: 'Integrante de prueba Reemplazo', role: 'vet' } });
    await prisma.appointment.create({ data: { tenantId: id, userId: user.id, petId: pet.id, petName: pet.name, petType: pet.type, serviceId: service.id, serviceType: 'vet', staffId: staff.id, date: new Date('2099-01-05T15:30:00Z'), status: 'confirmed', availabilityBucket: 'vet' } });
  }
  if (process.argv[2] === "services") {
    const grooming = await prisma.serviceCategory.create({ data: { tenantId: id, name: "grooming", appliesCommissionSplit: true } });
    const veterinary = await prisma.serviceCategory.create({ data: { tenantId: id, name: "veterinary" } });
    await prisma.service.createMany({ data: [
      { tenantId: id, categoryId: grooming.id, name: "Servicio de prueba Baño", duration: 60, basePrice: 55000 },
      { tenantId: id, categoryId: veterinary.id, name: "Servicio de prueba Consulta", duration: 30, basePrice: 66000 },
      { tenantId: id, categoryId: grooming.id, name: "Servicio de prueba Retirado", duration: 45, basePrice: 0, active: false },
    ] });
  }
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.get("X-Internal-Token") !== process.env.INTERNAL_API_SECRET) return res.status(401).json({ error: "Unauthorized" });
    req.tenant = { tenantId: id, isSuperAdmin: false };
    req.actor = { type: "admin", role: "admin", email: "verification@example.test" };
    next();
  });
  app.get("/api/dashboard/access", async (_req, res) => {
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id }, select: { activeModules: true } });
    res.json(effectiveAccess({ type: "admin", role: "admin" }, row.activeModules));
  });
  if (process.argv[2] === "services") {
    let failNextEdit = true;
    app.patch("/api/dashboard/services/:id", (req, res, next) => {
      if (!failNextEdit || req.body.name !== "Servicio de prueba Error") return next();
      failNextEdit = false;
      res.status(503).json({ error: "Error simulado de guardado" });
    });
    app.use("/api/dashboard", require("../backend/src/routes/dashboard/services.routes"));
  } else if (process.argv[2] === 'availability') app.get('/api/dashboard/services', async (_req,res) => res.json((await prisma.service.findMany({where:{tenantId:id},include:{category:true}})).map(row=>({...row,category:row.category.name}))));
  else app.get("/api/dashboard/services", (_req, res) => res.json([]));
  if (['team', 'availability'].includes(process.argv[2])) {
    let failFirstLoad = process.argv[2] === 'team', failEdit = true;
    app.get("/api/dashboard/staff", (_req, res, next) => {
      if (!failFirstLoad) return next();
      failFirstLoad = false; res.status(503).json({ error: "Error simulado de carga" });
    });
    app.patch("/api/dashboard/staff/:id", (req, res, next) => {
      if (!failEdit || req.body.name !== "Integrante de prueba Error") return next();
      failEdit = false; res.status(503).json({ error: "Error simulado de guardado" });
    });
    app.use("/api/dashboard", require("../backend/src/routes/dashboard/staff.routes"));
    if (process.argv[2] === 'availability') app.use('/api/dashboard',require('../backend/src/routes/dashboard/appointments.routes'));
  } else app.get("/api/dashboard/staff", (_req, res) => res.json([]));
  if (process.argv[2] === "hours") {
    let failFirstHoursSave = true;
    app.put("/api/dashboard/tenant/profile", (req, res, next) => {
      if (!req.body.businessHours || !failFirstHoursSave) return next();
      failFirstHoursSave = false;
      return res.status(503).json({ error: "Error simulado al guardar horarios" });
    });
    app.use("/api/dashboard", require("../backend/src/routes/dashboard/agenda-exceptions.routes"));
  }
  app.put("/api/dashboard/tenant/profile", (req, res, next) => req.body.name === "Prueba error de guardado" ? res.status(503).json({ error: "Error simulado: los datos no se guardaron. Intenta de nuevo." }) : next());
  let failNextConfig = process.argv[2] === "areas";
  app.put("/api/dashboard/tenant/config", (_req, res, next) => {
    if (!failNextConfig) return next();
    failNextConfig = false;
    res.status(503).json({ error: "Error simulado: las áreas no se guardaron. Intenta de nuevo." });
  });
  app.use("/api/dashboard", require("../backend/src/routes/dashboard/tenant.routes"));
  const server = app.listen(apiPort, "127.0.0.1", () => console.log("Fixture API ready on loopback:3120; only the disposable tenant is accessible."));
  const child = spawn(process.execPath, [path.join(root, "frontend/node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(uiPort)], {
    cwd: path.join(root, "frontend"), env: { ...process.env, NEXT_VERIFY_BUILD: "1", API_URL: `http://127.0.0.1:${apiPort}`, NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`, NEXTAUTH_URL: `http://localhost:${uiPort}`, AUTH_URL: `http://localhost:${uiPort}` }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  child.stdout.on("data", (data) => { if (data.toString().includes("Ready")) console.log("Fixture frontend ready: http://localhost:3121/dashboard/settings"); });
  child.stderr.on("data", () => console.log("Frontend diagnostic received; inspect the browser state."));
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    child.kill();
    server.close();
    try {
      await removeFixture();
    } finally { await prisma.$disconnect(); process.exit(0); }
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.once("exit", () => { if (!stopping) void stop(); });
}
main().catch(async (error) => { console.error(error.message); await prisma.$disconnect(); process.exitCode = 1; });
