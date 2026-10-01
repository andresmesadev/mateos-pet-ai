const { createControlConversationUseCase } = require("../application/use-cases/control-conversation.usecase");
const { createTeamDeliveryGuard } = require("../infrastructure/providers/team-delivery-guard");
const { createSendMessageUseCase } = require("../application/use-cases/send-message.usecase");
const { runExclusive } = require("../../../services/phone-lock.service");

const ana = { id: "staff:ana", name: "Dra. Ana", role: "vet" };
const luis = { id: "staff:luis", name: "Luis", role: "receptionist" };
const admin = { id: "admin:owner@example.com", name: "Dueño", role: "admin" };
function setup() {
  let row = { id: "chat", tenantId: "tenant-a", userId: "owner", status: "activa", controlVersion: 0, assignedActorId: null, user: { phone: "00000001" } };
  const repository = {
    findScoped: jest.fn(async (id, tenantId) => id === row.id && tenantId === row.tenantId ? { ...row } : null),
    findCanonical: jest.fn(async (userId, tenantId) => userId === row.userId && tenantId === row.tenantId ? { ...row } : null),
    changeControl: jest.fn(async (current, actor) => {
      if(current.controlVersion !== row.controlVersion)return null;
      row = { ...row, assignedActorId: actor?.id ?? null, assignedActorName: actor?.name ?? null,
        status: actor ? "esperando_humano" : "activa", controlVersion: row.controlVersion+1, controlChangedAt: new Date() };
      return { ...row };
    }),
  };
  const publish = jest.fn(async ()=>{});
  const control = createControlConversationUseCase({ repository, runExclusive, eventPublisher: { publish } });
  const guard = createTeamDeliveryGuard({ repository, runExclusive });
  const command = (actor, action, version, extra={}) => control({ tenantId:"tenant-a", conversationId:"chat", actor, action, expectedVersion:version, ...extra });
  return { repository, guard, command, control, publish, row:()=>row };
}

test("dos tomas simultáneas dejan un único responsable y una sola versión", async ()=>{
  const s = setup();
  const results = await Promise.allSettled([s.command(ana,"take",0), s.command(luis,"take",0)]);
  expect(results.map(r=>r.status)).toEqual(["fulfilled","rejected"]);
  expect(results[1].reason.status).toBe(409);
  expect(s.row()).toMatchObject({ assignedActorId:ana.id,status:"esperando_humano",controlVersion:1 });
  expect(s.publish).toHaveBeenCalledWith("ConversaciónEscalada",expect.anything());
});
test("un integrante no puede robar ni devolver el hilo ajeno", async ()=>{
  const s = setup();await s.command(ana,"take",0);
  await expect(s.command(luis,"take",1,{takeOver:true})).rejects.toMatchObject({status:409});
  await expect(s.command(luis,"release",1)).rejects.toMatchObject({status:409});
  expect(s.row().assignedActorId).toBe(ana.id);
});
test("administrador necesita una toma explícita para cambiar responsable y puede devolver", async ()=>{
  const s = setup();await s.command(ana,"take",0);
  await expect(s.command(admin,"take",1)).rejects.toMatchObject({status:409});
  await s.command(admin,"take",1,{takeOver:true});
  expect(s.row()).toMatchObject({assignedActorId:admin.id,controlVersion:2});
  await s.command(admin,"release",2);
  expect(s.row()).toMatchObject({assignedActorId:null,status:"activa",controlVersion:3});
  expect(s.publish).toHaveBeenLastCalledWith("EscalaciónDeConversaciónResuelta",expect.anything());
});
test("identidad ausente, establecimiento ajeno y versiones inválidas fallan antes de cambiar estado", async ()=>{
  const s=setup();
  await expect(s.control({tenantId:"tenant-b",conversationId:"chat",actor:ana,action:"take",expectedVersion:0})).rejects.toMatchObject({status:404});
  await expect(s.command({name:"falso",role:"admin"},"take",0)).rejects.toMatchObject({status:403});
  await expect(s.command(ana,"take",undefined)).rejects.toMatchObject({status:400});
  await expect(s.command(ana,"take",-1)).rejects.toMatchObject({status:400});
  expect(s.repository.changeControl).not.toHaveBeenCalled();
});
test("el guard rechaza autor ajeno, versión antigua y falso autor antes del proveedor", async ()=>{
  const s=setup();await s.command(ana,"take",0);const deliver=jest.fn();
  const input={tenantId:"tenant-a",userId:"owner",conversationId:"chat",phone:"00000001",origin:"agente",expectedVersion:1};
  await expect(s.guard({...input,author:luis},deliver)).rejects.toMatchObject({status:409});
  await expect(s.guard({...input,author:ana,expectedVersion:0},deliver)).rejects.toMatchObject({status:409});
  await expect(s.guard({...input,author:{id:null,name:"falso",role:"admin"}},deliver)).rejects.toMatchObject({status:409});
  expect(deliver).not.toHaveBeenCalled();
});
test("IA pendiente se omite durante atención humana; sistema conserva notificaciones", async ()=>{
  const s=setup();await s.command(ana,"take",0);const deliver=jest.fn(async()=>({message:{id:"sent"}}));
  const input={tenantId:"tenant-a",userId:"owner",conversationId:"chat",phone:"00000001",origin:"agente"};
  expect(await s.guard(input,deliver)).toEqual({message:null,skipped:true});expect(deliver).not.toHaveBeenCalled();
  expect(await s.guard({...input,origin:"sistema"},deliver)).toMatchObject({message:{id:"sent"}});
});
test("al devolver se descarta la respuesta preparada antes del cambio y se permite una nueva", async ()=>{
  const s=setup();await s.command(ana,"take",0);await s.command(ana,"release",1);
  const deliver=jest.fn(async()=>({message:{id:"new"}}));
  const input={tenantId:"tenant-a",userId:"owner",phone:"00000001",origin:"agente"};
  expect(await s.guard(input,deliver)).toMatchObject({skipped:true}); // checkpoint anterior sin fecha
  expect(await s.guard({...input,preparedAt:"2020-01-01T00:00:00Z"},deliver)).toMatchObject({skipped:true});
  expect(await s.guard({...input,preparedAt:"inválido"},deliver)).toMatchObject({skipped:true});
  expect(await s.guard({...input,preparedAt:new Date(Date.now()+1000).toISOString()},deliver)).toMatchObject({message:{id:"new"}});
});
test("solo una respuesta entregada conserva snapshot de autor autenticado", async ()=>{
  const s=setup();await s.command(ana,"take",0);
  const create=jest.fn(async data=>({id:"message",...data}));const provider=jest.fn(async()=>true);
  const send = createSendMessageUseCase({channelRepository:{findActiveDefault:async()=>({id:"channel",type:"whatsapp"})},
    conversationRepository:{findById:async()=>s.row()},messageRepository:{create},channelProvider:{send:provider},
    eventPublisher:{publish:async()=>{}},deliveryGuard:s.guard});
  const input={tenantId:"tenant-a",userId:"owner",conversationId:"chat",phone:"00000001",content:"Respuesta",origin:"agente",author:ana,expectedVersion:1};
  const result=await send(input);
  expect(result.message).toMatchObject({senderKind:"human",senderActorId:ana.id,senderName:ana.name,senderRole:"vet"});
  await s.command(ana,"release",1);
  await expect(send(input)).rejects.toMatchObject({status:409});
  expect(provider).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(1);
});
test("el mutex se libera antes de publicar para que un consumidor pueda responder al mismo teléfono", async ()=>{
  const s=setup();const delivered=jest.fn(async()=>({message:{id:"notification"}}));
  const control=createControlConversationUseCase({repository:s.repository,runExclusive,eventPublisher:{
    publish:async()=>s.guard({userId:"owner",tenantId:"tenant-a",phone:"00000001",origin:"sistema"},delivered),
  }});
  await expect(control({tenantId:"tenant-a",conversationId:"chat",actor:ana,action:"take",expectedVersion:0}))
    .resolves.toMatchObject({assignedActorId:ana.id});
  expect(delivered).toHaveBeenCalledTimes(1);
});
