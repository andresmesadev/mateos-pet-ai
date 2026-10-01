jest.mock("../../lib/prisma",()=>({conversation:{findFirst:jest.fn()},user:{findFirst:jest.fn()},appointment:{findMany:jest.fn(),findFirst:jest.fn()}}));
const prisma=require("../../lib/prisma");
const {getConversationContext}=require("../dashboard-conversation-context.service");
beforeEach(()=>{
  jest.clearAllMocks();prisma.conversation.findFirst.mockResolvedValue({userId:"owner"});
  prisma.user.findFirst.mockResolvedValue({id:"owner",name:"Ana",phone:"000",pets:[{id:"pet",name:"Luna",type:"dog"}]});
  prisma.appointment.findMany.mockResolvedValue([]);prisma.appointment.findFirst.mockResolvedValue(null);
});
test.each(["admin","vet","groomer","receptionist"])("contexto %s respeta propietario, establecimiento y acciones autorizadas",async role=>{
  const result=await getConversationContext("chat","tenant-a",role);
  expect(prisma.conversation.findFirst.mock.calls[0][0].where).toEqual({id:"chat",tenantId:"tenant-a"});
  expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({id:"owner",tenantId:"tenant-a"});
  for(const [query] of prisma.appointment.findMany.mock.calls){
    expect(query.where).toMatchObject({userId:"owner",tenantId:"tenant-a"});
    expect(query.select).not.toHaveProperty("finalPrice");expect(query.select).not.toHaveProperty("medicalRecord");
    if(["vet","groomer"].includes(role))expect(query.where.AND[0].OR[0].service.is.category.is.name).toBe(role==="vet"?"veterinary":"grooming");
  }
  expect(result.permissions.canViewClinical).toBe(["admin","vet"].includes(role));
  expect(result.permissions.canCreateAppointment).toBe(["admin","receptionist"].includes(role));
  expect(result.permissions.canViewGrooming).toBe(["admin","groomer"].includes(role));
  const selection=prisma.user.findFirst.mock.calls[0][0].select;
  expect(selection).not.toHaveProperty("notes");expect(selection.pets.select).not.toHaveProperty("notes");
});
test("citas de próximas fechas muestran nombre real de servicio, mascota y profesional",async()=>{
  prisma.appointment.findMany.mockResolvedValueOnce([{id:"appt",date:new Date(),status:"confirmed",petId:"pet",petName:"viejo",serviceType:"grooming",pet:{name:"Luna"},service:{name:"Baño piel sensible",category:{name:"grooming"}},staff:{name:"Pablo"}}]);
  const result=await getConversationContext("chat","tenant-a","admin");
  expect(result.upcoming[0]).toMatchObject({petName:"Luna",serviceName:"Baño piel sensible",professional:"Pablo"});
  expect(prisma.appointment.findMany.mock.calls[0][0].where.status.in).toContain("pending");
  expect(prisma.appointment.findMany.mock.calls[0][0].orderBy).toEqual({date:"asc"});
});
test("un id de conversación ajeno no revela propietarios ni citas",async()=>{
  prisma.conversation.findFirst.mockResolvedValue(null);
  expect(await getConversationContext("foreign","tenant-a","admin")).toBeNull();
  expect(prisma.user.findFirst).not.toHaveBeenCalled();expect(prisma.appointment.findMany).not.toHaveBeenCalled();
});
