const express = require("express"), request = require("supertest");
jest.mock("../../lib/prisma", () => ({
  staffCredential: { findUnique: jest.fn(), findFirst: jest.fn() },
  tenant: { findUnique: jest.fn() },
}));
const prisma = require("../../lib/prisma");
const { hashPassword } = require("../../services/staff-credential.service");
const { resolveTenant } = require("../../middleware/resolveTenant");
const { allowVeterinaryDashboard } = require("../../middleware/allowVeterinaryDashboard");
const loginRoutes = require("../../routes/staff-auth.routes");
const app = express();app.use(express.json());app.use("/api/internal",loginRoutes);
app.use("/api/dashboard",(req,res,next)=>{req.actor={type:req.headers["test-role"] || "admin"};next();},allowVeterinaryDashboard,(req,res)=>res.json({allowed:true}));
let passwordHash;
beforeAll(async()=>{passwordHash=await hashPassword("Cuenta-local-de-prueba-123");});
beforeEach(()=>jest.clearAllMocks());

test("facturación revalida el rol y la versión de la credencial vigente, sin aceptar un rol del navegador",async()=>{
  prisma.staffCredential.findFirst.mockResolvedValue({staff:{role:"receptionist"}});
  const response=await request(app).get("/api/internal/staff-session").set("x-staff-id","staff-a")
    .set("x-staff-session-version","4").set("x-tenant-id","tenant-a").set("x-staff-role","admin");
  expect(response.status).toBe(200);expect(response.body.role).toBe("receptionist");
  expect(prisma.staffCredential.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{staffId:"staff-a",active:true,sessionVersion:4,staff:{tenantId:"tenant-a",active:true}}}));
  prisma.staffCredential.findFirst.mockResolvedValue(null);
  expect((await request(app).get("/api/internal/staff-session").set("x-staff-id","staff-a")
    .set("x-staff-session-version","4").set("x-tenant-id","tenant-a")).status).toBe(403);
  prisma.staffCredential.findFirst.mockClear();
  expect((await request(app).get("/api/internal/staff-session").set("x-staff-id","staff-a")).status).toBe(403);
  expect(prisma.staffCredential.findFirst).not.toHaveBeenCalled();
});

test.each(["admin","vet","groomer","receptionist"])("%s puede entrar con credencial y ver WhatsApp",async role=>{
  prisma.staffCredential.findUnique.mockResolvedValue({staffId:"staff-a",email:"team@example.com",passwordHash,active:true,sessionVersion:4,
    staff:{name:"Equipo",role,active:true,tenantId:"tenant-a",tenant:{active:true}}});
  const login=await request(app).post("/api/internal/staff-login").send({email:"team@example.com",password:"Cuenta-local-de-prueba-123"});
  expect(login.status).toBe(200);expect(login.body).toMatchObject({role,sessionVersion:4,tenantId:"tenant-a"});
  expect((await request(app).get("/api/dashboard/conversations").set("test-role",role)).status).toBe(200);
  expect((await request(app).patch("/api/dashboard/conversations/chat/control").set("test-role",role).send({action:"take"})).status).toBe(200);
});
test.each(["vet","groomer","receptionist"])("%s no puede administrar usuarios, precios ni finanzas",async role=>{
  for(const path of ["/transactions","/metrics","/staff/member/credential","/pets/p/prices/service"]){
    expect((await request(app).put(`/api/dashboard${path}`).set("test-role",role).send({})).status).toBe(403);
  }
  expect((await request(app).get("/api/dashboard/transactions").set("test-role",role)).status).toBe(403);
});
test.each(["groomer","receptionist"])("%s no puede extraer historia clínica por URL directa",async role=>{
  for(const path of ["/pets/p/records","/pets/p/timeline","/pets/p/report","/appointments/a/medical-record"]){
    expect((await request(app).get(`/api/dashboard${path}`).set("test-role",role)).status).toBe(403);
  }
});
test("recepción puede crear cita y peluquero solo consultar notas propias del módulo",async()=>{
  expect((await request(app).post("/api/dashboard/appointments").set("test-role","receptionist").send({})).status).toBe(200);
  expect((await request(app).get("/api/dashboard/appointments/available-slots").set("test-role","receptionist")).status).toBe(200);
  expect((await request(app).post("/api/dashboard/appointments").set("test-role","groomer").send({})).status).toBe(403);
  expect((await request(app).get("/api/dashboard/grooming/pets/p/notes").set("test-role","groomer")).status).toBe(200);
  expect((await request(app).get("/api/dashboard/grooming/pets/p/notes").set("test-role","receptionist")).status).toBe(403);
});
test("administrador conserva acceso clínico y administrativo en la misma identidad",async()=>{
  expect((await request(app).get("/api/dashboard/transactions")).status).toBe(200);
  expect((await request(app).get("/api/dashboard/pets/p/records")).status).toBe(200);
  expect((await request(app).put("/api/dashboard/appointments/a/medical-record").send({})).status).toBe(200);
});
test("sesión con rol anterior no prevalece sobre el rol actual de PostgreSQL; revocación bloquea",async()=>{
  const saved=process.env.SINGLE_TENANT_ID;process.env.SINGLE_TENANT_ID="tenant-a";
  prisma.tenant.findUnique.mockResolvedValue({active:true});
  prisma.staffCredential.findFirst.mockResolvedValue({staffId:"staff-a",staff:{role:"receptionist",name:"Ana recepción"}});
  const req={headers:{"x-staff-id":"staff-a","x-staff-session-version":"4","x-staff-role":"admin"}};
  const res={status:jest.fn().mockReturnThis(),json:jest.fn()};const next=jest.fn();
  try {
    await resolveTenant(req,res,next);expect(req.actor.type).toBe("receptionist");
    expect(prisma.staffCredential.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({active:true,sessionVersion:4,staff:expect.objectContaining({tenantId:"tenant-a",active:true})})}));
    prisma.staffCredential.findFirst.mockResolvedValue(null);next.mockClear();
    await resolveTenant(req,res,next);expect(res.status).toHaveBeenCalledWith(403);expect(next).not.toHaveBeenCalled();
  } finally {if(saved)process.env.SINGLE_TENANT_ID=saved;else delete process.env.SINGLE_TENANT_ID;}
});
