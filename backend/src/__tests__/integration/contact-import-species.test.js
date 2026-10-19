const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  user: { findMany: jest.fn(), createMany: jest.fn(), update: jest.fn() },
  pet: { findMany: jest.fn(), createMany: jest.fn() },
  medicalRecord: { findMany: jest.fn(), createMany: jest.fn() },
}));
jest.mock("../../services/next-action.service", () => ({ sendNextActionReminders: jest.fn() }));
jest.mock("../../services/dashboard-client.service", () => ({}));
jest.mock("../../services/dashboard-reactivation.service", () => ({}));
jest.mock("../../services/dashboard-access.service", () => ({ operationalPet: pet => pet }));

const prisma = require("../../lib/prisma");
const routes = require("../../routes/dashboard/clients.routes");
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.tenant = { tenantId: "tenant-a" }; next(); });
app.use("/api/dashboard", routes);
const endpoint = "/api/dashboard/clients/import/full";
const pet = (name, type) => ({ name, type, breed: "Criollo", price: "70000", last_visit: "2026-10-01", visit_history: "2026-09-01 | 2026-10-01" });
const contact = pets => ({ owner_name: "Cliente de prueba", phone: "3001234567", address: "Dirección de prueba", notes: 'Nota con "comillas"\ny salto.', pets });
let users, pets, records;

beforeEach(() => {
  jest.clearAllMocks(); users = []; pets = []; records = [];
  prisma.user.findMany.mockImplementation(async ({ where }) => users.filter(user => where.phone.in.includes(user.phone) && user.tenantId === where.tenantId));
  prisma.user.createMany.mockImplementation(async ({ data }) => {
    for (const value of data) if (!users.some(user => user.phone === value.phone && user.tenantId === value.tenantId)) users.push({ ...value, id: `owner-${users.length}` });
    return { count: data.length };
  });
  prisma.pet.findMany.mockImplementation(async ({ where }) => pets.filter(value => where.ownerId.in.includes(value.ownerId)));
  prisma.pet.createMany.mockImplementation(async ({ data }) => {
    data.forEach(value => pets.push({ ...value, id: `pet-${pets.length}` }));
    return { count: data.length };
  });
  prisma.medicalRecord.findMany.mockImplementation(async ({ where }) => records.filter(value => where.petId.in.includes(value.petId)));
  prisma.medicalRecord.createMany.mockImplementation(async ({ data }) => { records.push(...data); return { count: data.length }; });
});

test("persiste un perro y una gata del mismo propietario con especies independientes y sin alterar notas o precios", async () => {
  const value = contact([pet("Toby", " Perros "), pet("Luna", "FELINAS")]);
  const response = await request(app).post(endpoint).send({ contacts: [value] });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ ownersCreated: 1, petsCreated: 2, recordsCreated: 4, invalid: 0 });
  expect(pets).toMatchObject([
    { name: "Toby", type: "dog", tenantId: "tenant-a", defaultGroomingPrice: 70000 },
    { name: "Luna", type: "cat", tenantId: "tenant-a", defaultGroomingPrice: 70000 },
  ]);
  expect(pets[0].ownerId).toBe(pets[1].ownerId);
  expect(users[0].notes).toBe(value.notes);
  expect(records.filter(record => record.petId === pets[1].id)).toHaveLength(2);
});

test.each([undefined, "", "  ", "canario", 12, null, {}, ["cat"]])("rechaza una especie no reconocida (%p) antes de consultar o escribir datos", async type => {
  const response = await request(app).post(endpoint).send({ contacts: [contact([pet("Luna", type)])] });
  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/Luna/);
  expect(prisma.user.findMany).not.toHaveBeenCalled();
  expect(prisma.user.createMany).not.toHaveBeenCalled();
  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(prisma.pet.createMany).not.toHaveBeenCalled();
  expect(prisma.medicalRecord.createMany).not.toHaveBeenCalled();
});

test("una segunda mascota sin especie bloquea el lote entero aunque la primera sea válida", async () => {
  const response = await request(app).post(endpoint).send({ contacts: [contact([pet("Toby", "dog"), pet("Luna", "")])] });
  expect(response.status).toBe(400);
  expect(users).toHaveLength(0); expect(pets).toHaveLength(0); expect(records).toHaveLength(0);
});

test("acepta otro explícitamente y no exige especie en posiciones sin nombre", async () => {
  const response = await request(app).post(endpoint).send({ contacts: [contact([pet("Conejo", "otro"), { name: "", type: "" }])] });
  expect(response.status).toBe(200);
  expect(pets).toHaveLength(1);
  expect(pets[0].type).toBe("other");
});

test("reimportar el mismo gato conserva especie e historial sin crear otra mascota ni repetir visitas", async () => {
  const body = { contacts: [contact([pet("Luna", "cat")])] };
  expect((await request(app).post(endpoint).send(body)).status).toBe(200);
  const second = await request(app).post(endpoint).send(body);
  expect(second.status).toBe(200);
  expect(second.body).toMatchObject({ ownersCreated: 0, petsCreated: 0, recordsCreated: 0 });
  expect(pets).toHaveLength(1); expect(pets[0].type).toBe("cat");
  expect(records).toHaveLength(2);
});

test('importa peluquería en centro y total con domicilio en campos diferentes', async () => {
  const response = await request(app).post(endpoint).send({ contacts: [contact([{ ...pet('Luna', 'cat'), price: '95.000', with_transport_price: '103.000' }])] });
  expect(response.status).toBe(200);
  expect(pets[0]).toMatchObject({ defaultGroomingPrice: 95000, defaultGroomingWithTransportPrice: 103000, type: 'cat' });
});

test('rechaza importes contradictorios o mal formados sin crear clientes', async () => {
  for (const fields of [{ price: '95000', with_transport_price: '90000' }, { price: '-1' }, { with_transport_price: 'por confirmar' }]) {
    const response = await request(app).post(endpoint).send({ contacts: [contact([{ ...pet('Luna', 'cat'), ...fields }])] });
    expect(response.status).toBe(400); expect(users).toHaveLength(0);
  }
});

test("una gata de otro establecimiento no se reutiliza por compartir teléfono o nombre", async () => {
  users.push({ id: "foreign-owner", phone: "573001234567", name: "Otro cliente", tenantId: "tenant-b" });
  pets.push({ id: "foreign-pet", ownerId: "foreign-owner", name: "Luna", type: "cat", tenantId: "tenant-b" });
  const response = await request(app).post(endpoint).send({ tenantId: "tenant-b", contacts: [contact([pet("Luna", "gato")])] });
  expect(response.status).toBe(200);
  expect(pets).toHaveLength(2);
  expect(pets[1]).toMatchObject({ type: "cat", tenantId: "tenant-a" });
  expect(pets[1].ownerId).not.toBe("foreign-owner");
});
