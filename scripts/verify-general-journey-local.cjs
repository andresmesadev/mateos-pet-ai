// Real HTTP adapters and domain commands, isolated fixtures, one local rollback.
require("dotenv").config();
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname), "Solo se permite una base local");
  const prismaPath = require.resolve("../backend/src/lib/prisma");
  const prisma = require(prismaPath);
  const fixtureId = `general-journey-${randomUUID()}`;
  const rollback = new Error("ROLLBACK_GENERAL_JOURNEY");
  try {
    try {
      await prisma.$transaction(async (tx) => {
        // Isolated tenant: no automation rules, contacts or real appointments.
        const tenant = await tx.tenant.create({ data: { id: fixtureId, name: "Verificación local", slug: fixtureId, phone: fixtureId, activeModules: ["veterinary", "grooming", "retail"] } });
        const owner = await tx.user.create({ data: { tenantId: tenant.id, name: "Propietario de prueba", phone: "000000000000" } });
        const pet = await tx.pet.create({ data: { tenantId: tenant.id, ownerId: owner.id, name: "Mascota de prueba", type: "dog", breed: "Mestizo", notes: "Cuidados de prueba" } });
        const category = await tx.serviceCategory.create({ data: { tenantId: tenant.id, name: "grooming", appliesCommissionSplit: true } });
        const service = await tx.service.create({ data: { tenantId: tenant.id, categoryId: category.id, name: "Baño de prueba", duration: 60 } });
        const staff = await tx.staff.create({ data: { tenantId: tenant.id, name: "Peluquero de prueba", role: "groomer" } });
        const appointmentData = { petId: pet.id, userId: owner.id, tenantId: tenant.id, petName: pet.name, petType: pet.type, serviceType: "grooming", serviceId: service.id, status: "confirmed" };
        const appointment = await tx.appointment.create({ data: { ...appointmentData, id: `${fixtureId}-visit`, date: new Date(Date.now() + 120000) } });
        // Share the outer transaction across real repositories/nested units of work.
        require.cache[prismaPath].exports = new Proxy(tx, { get(target, key) {
          if (key === "$transaction") return (callback) => Array.isArray(callback) ? Promise.all(callback) : callback(tx);
          const value = target[key]; return typeof value === "function" ? value.bind(target) : value;
        } });
        try {
          const app = express(); app.use(express.json());
          app.use((req, res, next) => { req.tenant = { tenantId: tenant.id }; req.actor = { type: req.get("x-test-role") || "admin", name: "Prueba", email: "journey@example.invalid" }; next(); });
          app.use("/api/dashboard", require("../backend/src/middleware/allowVeterinaryDashboard").allowVeterinaryDashboard);
          app.use("/api/dashboard", require("../backend/src/routes/dashboard/appointments.routes"));
          app.use("/api/dashboard", require("../backend/src/routes/dashboard/grooming.routes"));
          app.use("/api/dashboard", require("../backend/src/routes/dashboard/transactions.routes"));
          app.use("/api/dashboard", require("../backend/src/routes/dashboard/reports.routes"));
          const visitUrl = `/api/dashboard/appointments/${appointment.id}`;
          const noteUrl = `/api/dashboard/grooming/appointments/${appointment.id}/notes`;
          async function ok(promise) { const res = await promise; assert.equal(res.status, 200, JSON.stringify(res.body)); return res.body; }
          await ok(request(app).patch(visitUrl).send({ staffId: staff.id }));
          assert.equal((await ok(request(app).patch(visitUrl).send({ status: "arrived" }))).status, "arrived");
          const started = await ok(request(app).patch(visitUrl).send({ status: "in_progress" }));
          assert.equal(started.status, "in_progress"); assert(started.startedAt);
          assert.equal((await request(app).post(`${visitUrl}/complete`).send({})).status, 422);
          assert.equal(await tx.transaction.count({ where: { appointmentId: appointment.id } }), 0);
          await ok(request(app).patch(`${visitUrl}/agreed-price`).send({ price: 55000 }));
          const saved = await ok(request(app).put(noteUrl).send({ notes: "Corte redondeado. Champú suave. Cepillar en casa.", expectedVersion: 1 }));
          assert.equal(saved.groomingNotesVersion, 2);
          assert.equal((await request(app).put(noteUrl).send({ notes: "No sobrescribir", expectedVersion: 1 })).status, 409);
          const completed = await ok(request(app).post(`${visitUrl}/complete`).send({}));
          assert.equal(completed.status, "completed"); assert.equal(completed.finalPrice, 55000);
          assert.equal(await tx.transaction.count({ where: { appointmentId: appointment.id } }), 1);
          assert.equal(await tx.commission.count({ where: { appointmentId: appointment.id } }), 1);
          assert.equal((await request(app).post(`${visitUrl}/complete`).send({})).status, 422);
          const deliveryUrl = `/api/dashboard/grooming/appointments/${appointment.id}/delivery`;
          const first = await ok(request(app).post(deliveryUrl)); const second = await ok(request(app).post(deliveryUrl));
          assert(first.groomingDeliveredAt); assert.equal(first.groomingDeliveredAt, second.groomingDeliveredAt);
          assert.equal(await tx.transaction.count({ where: { appointmentId: appointment.id } }), 1);
          assert.equal(await tx.commission.count({ where: { appointmentId: appointment.id } }), 1);
          const next = await tx.appointment.create({ data: { ...appointmentData, id: `${fixtureId}-next`, date: new Date(appointment.date.getTime() + 30 * 86400000) } });
          assert.equal(next.groomingNotes, null, "Las notas no se copian a otra visita");
          const history = await ok(request(app).get(`/api/dashboard/grooming/pets/${pet.id}/notes?exclude=${next.id}&cursor=${next.id}`));
          assert.equal(history.visits[0].id, appointment.id); assert.equal(history.visits[0].groomingNotes, saved.groomingNotes);
          const nextNote = await ok(request(app).put(`/api/dashboard/grooming/appointments/${next.id}/notes`).send({ notes: "Nota diferente para la próxima visita.", expectedVersion: 1 }));
          assert.equal(nextNote.finalPrice, 55000, "Se conserva el precio por mascota y servicio");
          assert.equal((await tx.appointment.findUnique({ where: { id: appointment.id } })).groomingNotes, saved.groomingNotes);

          // A second area uses the same owner/pet without overwriting either visit.
          const vet = await tx.staff.create({data:{tenantId:tenant.id,name:"Veterinario de prueba",role:"vet"}});
          const vetCategory = await tx.serviceCategory.create({data:{tenantId:tenant.id,name:"veterinary",appliesCommissionSplit:false}});
          const vetService = await tx.service.create({data:{tenantId:tenant.id,categoryId:vetCategory.id,name:"Consulta de prueba",duration:45,basePrice:66000}});
          const clinical = await tx.appointment.create({data:{...appointmentData,id:fixtureId+"-clinical",serviceType:"vet",serviceId:vetService.id,staffId:vet.id,finalPrice:66000,date:new Date(Date.now()+120000)}});
          const clinicalUrl = "/api/dashboard/appointments/"+clinical.id;
          await ok(request(app).patch(clinicalUrl).send({status:"arrived"}));
          await ok(request(app).patch(clinicalUrl).send({status:"in_progress"}));
          const record = await ok(request(app).put(clinicalUrl+"/medical-record").send({staffId:vet.id,reason:"Control de prueba",findings:"Hallazgo de prueba",diagnosis:"Diagnóstico de prueba",treatment:"Tratamiento de prueba",weight:8.5}));
          assert.equal((await tx.pet.findUnique({where:{id:pet.id}})).weight,8.5);
          assert.equal((await ok(request(app).get(clinicalUrl+"/medical-record"))).id,record.id);
          assert.equal((await request(app).get(clinicalUrl+"/medical-record").set("x-test-role","receptionist")).status,403);
          assert.equal((await request(app).get(clinicalUrl+"/medical-record").set("x-test-role","groomer")).status,403);
          await ok(request(app).post(clinicalUrl+"/complete").send({}));
          const clinicalCharge = await tx.transaction.findFirstOrThrow({where:{appointmentId:clinical.id}});
          assert.equal(Number(clinicalCharge.total),66000);
          const transactionCount = await tx.transaction.count({where:{tenantId:tenant.id}});
          const settled = await ok(request(app).post("/api/dashboard/transactions/"+clinicalCharge.id+"/settle").set("x-test-role","receptionist").send({paymentMethod:"cash"}));
          assert.equal(settled.total,66000);
          assert.equal(await tx.transaction.count({where:{tenantId:tenant.id}}),transactionCount);
          const receipt = await ok(request(app).get("/api/dashboard/transactions/"+clinicalCharge.id).set("x-test-role","receptionist"));
          assert.equal(receipt.id,clinicalCharge.id);assert.equal(receipt.total,66000);
          const summary = await ok(request(app).get("/api/dashboard/reports/summary?period=month&offset=0"));
          assert.equal(summary.revenue.value,121000);assert.equal(summary.transactionCount,2);
          assert.equal(summary.petsAttended.value,1);
          assert.equal((await request(app).get("/api/dashboard/reports/summary?period=month").set("x-test-role","receptionist")).status,403);
          const later = await tx.appointment.create({data:{...appointmentData,id:fixtureId+"-later",serviceType:"vet",serviceId:vetService.id,staffId:vet.id,date:new Date(Date.now()+90*86400000)}});
          assert.equal((await request(app).get("/api/dashboard/appointments/"+later.id+"/medical-record")).status,404);
          assert.equal((await tx.medicalRecord.findUnique({where:{appointmentId:clinical.id}})).id,record.id);
          assert.equal((await tx.appointment.findUnique({where:{id:appointment.id}})).groomingNotes,saved.groomingNotes);
          console.log("PASS: consulta → historia y peso → cierre → recepción confirma cobro sin duplicar → recibo → reporte reconciliado (121000, 2 cobros, 1 mascota).");
          console.log("PASS: recepción/peluquería sin acceso clínico, recepción sin reportes; visita futura sin copiar historia y antecedentes preservados.");
          console.log("PASS: llegada → inicio → precio por mascota → notas → cierre (1 cobro, 1 comisión) → entrega idempotente → historial en siguiente visita.");
        } finally { require.cache[prismaPath].exports = prisma; }
        throw rollback;
      }, { timeout: 45000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert.equal(await prisma.tenant.findUnique({ where: { id: fixtureId } }), null);
    assert.equal(await prisma.appointment.count({ where: { tenantId: fixtureId } }), 0);
    console.log("PASS: rollback completo; sin datos de prueba persistidos ni citas reales modificadas.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });

