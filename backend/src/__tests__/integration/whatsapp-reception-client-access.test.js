const express = require("express"), request = require("supertest");
jest.mock("../../lib/prisma",()=>({user:{findMany:jest.fn()}}));
jest.mock("../../contexts/communication",()=>({sendMessage:jest.fn()}));
jest.mock("../../services/next-action.service",()=>({sendNextActionReminders:jest.fn()}));
jest.mock("../../services/dashboard-client.service",()=>({listClients:jest.fn(),getClientById:jest.fn(),updateClient:jest.fn(),listInactiveClients:jest.fn()}));
const {listClients,getClientById}=require("../../services/dashboard-client.service");
const routes=require("../../routes/dashboard/clients.routes");
const app=express();app.use(express.json());app.use((req,res,next)=>{req.tenant={tenantId:"tenant-a"};req.actor={type:"receptionist"};next();});app.use("/api/dashboard",routes);
test("recepción solo obtiene identidad y contacto en el listado general, incluso sin autocompletado",async()=>{
  listClients.mockResolvedValue({data:[{id:"owner",name:"Ana",phone:"000",notes:"Reservado",sessionData:{diagnosis:"Reservado"}}],total:1,page:1,totalPages:1});
  const response=await request(app).get("/api/dashboard/clients");
  expect(response.status).toBe(200);expect(response.body).toMatchObject({data:[{id:"owner",name:"Ana",phone:"000"}],total:1,page:1,totalPages:1});
  expect(response.body.data[0]).not.toHaveProperty("notes");
  expect(response.body.data[0]).not.toHaveProperty("sessionData");
  expect(listClients).toHaveBeenCalledWith("tenant-a",expect.anything());
});
test("detalle para reservar no filtra pesos, notas, historial ni precios del expediente",async()=>{
  getClientById.mockResolvedValue({id:"owner",name:"Ana",phone:"000",notes:"Reservado",appointments:[{finalPrice:60000}],pets:[{id:"pet",name:"Luna",type:"dog",weight:12,notes:"Reservado",defaultGroomingPrice:50000}]});
  const response=await request(app).get("/api/dashboard/clients/owner");
  expect(response.status).toBe(200);expect(response.body).toMatchObject({id:"owner",name:"Ana",phone:"000",pets:[{id:"pet",name:"Luna",type:"dog"}]});
  expect(response.body).not.toHaveProperty("notes");
  for (const key of ["weight", "notes", "defaultGroomingPrice"]) expect(response.body.pets[0]).not.toHaveProperty(key);
  expect(response.body.appointments[0]).not.toHaveProperty("finalPrice");
  expect(getClientById).toHaveBeenCalledWith("owner","tenant-a");
});
