// Datos sintéticos temporales, exclusivamente mateos_dev local. Sin teléfono.
const path = require("node:path"), assert = require("node:assert/strict");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env"), quiet: true });
const prisma = require("../backend/src/lib/prisma");
const prefix = "local-wa-team-check-", ownerId = `${prefix}owner`, petId = `${prefix}pet`, chatId = `${prefix}chat`;
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)); assert.equal(url.pathname, "/mateos_dev");
  const tenantId = process.env.SINGLE_TENANT_ID; assert(tenantId);
  const mode = process.argv[2];
  if (mode === "prepare") {
    assert.equal(await prisma.user.count({where:{id:ownerId}}),0);
    const services=await prisma.service.findMany({where:{tenantId,active:true},include:{category:true}});
    const vet=services.find(s=>s.category.name==="veterinary"), groom=services.find(s=>s.category.name==="grooming");
    assert(vet && groom,"Se requieren servicios existentes de veterinaria y peluquería");
    await prisma.$transaction(async tx=>{
      await tx.user.create({data:{id:ownerId,tenantId,name:"Prueba equipo · Ana",phone:""}});
      await tx.pet.create({data:{id:petId,tenantId,ownerId,name:"Luna de prueba",type:"dog",breed:"Mestiza"}});
      await tx.conversation.create({data:{id:chatId,tenantId,userId:ownerId,status:"activa",step:"idle"}});
      await tx.message.createMany({data:[
        {id:`${prefix}m1`,conversationId:chatId,role:"user",origin:"cliente",content:"Hola, ¿pueden revisar la próxima visita de Luna?",createdAt:new Date(Date.now()-180000)},
        {id:`${prefix}m2`,conversationId:chatId,role:"assistant",origin:"agente",senderKind:"ai",content:"Claro, el equipo puede ayudarte con su agenda.",createdAt:new Date(Date.now()-120000)},
        {id:`${prefix}m3`,conversationId:chatId,role:"assistant",origin:"agente",senderKind:"human",senderActorId:"staff:fixture",senderName:"Dra. Ana",senderRole:"vet",content:"Ya revisé los datos de Luna. Conservamos el historial de sus visitas.",createdAt:new Date(Date.now()-60000)},
        {id:`${prefix}m4`,conversationId:chatId,role:"assistant",origin:"sistema",senderKind:"system",content:"La cita quedó registrada en la agenda.",createdAt:new Date(Date.now()-30000)},
      ]});
      const base={tenantId,userId:ownerId,petId,petName:"Luna de prueba",petType:"dog",reminderSent:true,followUpSent:true};
      for(const [suffix,service,date,status] of [["next-vet",vet,Date.now()+7*86400000,"confirmed"],["next-groom",groom,Date.now()+8*86400000,"confirmed"],["last-groom",groom,Date.now()-7*86400000,"completed"]]) {
        await tx.appointment.create({data:{...base,id:`${prefix}${suffix}`,serviceId:service.id,serviceType:service.name,date:new Date(date),status,
          ...(status==="completed"?{groomingNotes:"Se utilizó champú suave. Corte corto y patas redondeadas; sin novedades."}: {})}});
      }
    });
    console.log("PASS: cliente, mascota, cuatro mensajes y tres citas sintéticas. Teléfono vacío: ningún envío externo posible.");
    return;
  }
  const owner=await prisma.user.findUniqueOrThrow({where:{id:ownerId}});
  assert.equal(owner.tenantId,tenantId);assert.equal(owner.phone,"");assert.equal(owner.name,"Prueba equipo · Ana");
  if(mode==="team") {
    const {hashPassword}=require("../backend/src/services/staff-credential.service");
    const passwordHash=await hashPassword("Local-team-check-only-123");
    await prisma.$transaction(async tx=>{
      for(const role of ["vet","groomer","receptionist"]) {
        const staffId=`${prefix}${role}`;
        await tx.staff.create({data:{id:staffId,tenantId,name:`Prueba ${role}`,role}});
        await tx.staffCredential.create({data:{staffId,email:`${prefix}${role}@example.invalid`,passwordHash}});
      }
      await tx.appointment.update({where:{id:`${prefix}next-vet`},data:{staffId:`${prefix}vet`}});
      await tx.appointment.update({where:{id:`${prefix}next-groom`},data:{staffId:`${prefix}groomer`}});
    });
    console.log("PASS: tres credenciales sintéticas locales para comprobar navegación por responsabilidad.");
  } else if(mode==="other") {
    await prisma.conversation.update({where:{id:chatId},data:{status:"esperando_humano",assignedActorId:"staff:fixture",assignedActorName:"Dra. Ana",assignedActorRole:"vet",assignedAt:new Date(),controlChangedAt:new Date(),controlVersion:{increment:1}}});
    console.log("PASS: conversación sintética tomada por otra profesional para comprobar la confirmación de traspaso.");
  } else if(mode==="verify") {
    const {getConversationContext}=require("../backend/src/services/dashboard-conversation-context.service");
    const roles=["admin","vet","groomer","receptionist"];
    for(const role of roles) {
      const context=await getConversationContext(chatId,tenantId,role);
      assert.equal(context.upcoming.length,["vet","groomer"].includes(role)?1:2);
      assert(context.upcoming.every(a=>a.petName==="Luna de prueba"&&a.serviceName));
      assert.equal(context.lastVisit!==null,role!=="vet");
      assert(!JSON.stringify(context).includes("finalPrice"));
    }
    const row=await prisma.conversation.findUniqueOrThrow({where:{id:chatId}});
    assert.equal(row.assignedActorId,null);assert.equal(row.status,"activa");assert(row.controlVersion>=4);
    assert.equal(await prisma.message.count({where:{conversationId:chatId}}),4);
    console.log("PASS: contexto real en PostgreSQL por los cuatro perfiles, toma/traspaso/devolución durable y cero mensajes enviados.");
  } else if(mode==="cleanup") {
    await prisma.$transaction(async tx=>{
      const appointments=await tx.appointment.findMany({where:{userId:ownerId}});
      assert.equal(appointments.length,3);assert(appointments.every(a=>a.id.startsWith(prefix)&&a.tenantId===tenantId));
      const ids=appointments.map(a=>a.id);
      assert.equal(await tx.transaction.count({where:{appointmentId:{in:ids}}}),0);
      assert.equal(await tx.commission.count({where:{appointmentId:{in:ids}}}),0);
      const events=await tx.domainEvent.findMany({where:{tenantId,payload:{path:["conversation","id"],equals:chatId}},select:{id:true}});
      const eventIds=events.map(e=>e.id);
      assert.equal(await tx.automationExecution.count({where:{domainEventId:{in:eventIds}}}),0);
      await tx.eventDelivery.deleteMany({where:{domainEventId:{in:eventIds}}});
      await tx.domainEvent.deleteMany({where:{id:{in:eventIds}}});
      await tx.appointment.deleteMany({where:{id:{in:ids},tenantId,userId:ownerId}});
      const team=await tx.staff.findMany({where:{id:{startsWith:prefix},tenantId}});
      assert(team.length<=3);assert(team.every(s=>s.name.startsWith("Prueba ")));
      await tx.staff.deleteMany({where:{id:{in:team.map(s=>s.id)},tenantId}});
      await tx.message.deleteMany({where:{conversationId:chatId,id:{startsWith:prefix}}});
      await tx.conversation.deleteMany({where:{id:chatId,tenantId,userId:ownerId}});
      await tx.pet.deleteMany({where:{id:petId,tenantId,ownerId}});
      await tx.user.deleteMany({where:{id:ownerId,tenantId,phone:""}});
    });
    console.log("PASS: solo datos sintéticos retirados; datos del negocio conservados.");
  } else throw new Error("Usa prepare, other, verify o cleanup");
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
