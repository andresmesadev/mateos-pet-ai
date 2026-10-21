const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async ({ prisma, check }) => {
  const id=randomUUID();
  const tenant=await prisma.tenant.create({data:{name:'Lifecycle test',slug:'lifecycle-'+id,phone:'lifecycle-'+id}});
  const owner=await prisma.user.create({data:{tenantId:tenant.id,name:'Owner',phone:id}});
  const pet=await prisma.pet.create({data:{tenantId:tenant.id,ownerId:owner.id,name:'Pet',type:'dog'}});
  const otherPet=await prisma.pet.create({data:{tenantId:tenant.id,ownerId:owner.id,name:'Other pet',type:'dog'}});
  const cat=await prisma.serviceCategory.create({data:{tenantId:tenant.id,name:'grooming'}});
  const service=await prisma.service.create({data:{tenantId:tenant.id,categoryId:cat.id,name:'Grooming',duration:20}});
  const different=await prisma.service.create({data:{tenantId:tenant.id,categoryId:cat.id,name:'Other service',duration:20}});
  const base={tenantId:tenant.id,userId:owner.id,petId:pet.id,petName:'Pet',petType:'dog',serviceType:'grooming',serviceId:service.id,status:'confirmed'};
  const make=(time,extra={},db=prisma)=>db.appointment.create({data:{...base,date:new Date(time),...extra}});
  const duplicate=fn=>assert.rejects(fn,e=>require('../backend/src/services/errors/duplicate-pet-appointment.error').isDuplicatePetAppointment(e));
  let first;
  await check('Same pet/service/day rejects a different time; distinct service/pet/day remain valid',async()=>{
    first=await make('2099-02-02T15:00Z');
    await duplicate(()=>make('2099-02-02T15:20Z'));
    await make('2099-02-02T16:00Z',{serviceId:different.id,serviceType:'vet'});
    await make('2099-02-02T16:20Z',{petId:otherPet.id});
    await make('2099-02-03T15:00Z');
  });
  await check('Colombia day boundaries, completed reservations and cancelled/no-show release',async()=>{
    await duplicate(()=>make('2099-02-04T04:59:59.999Z')); // Still Feb 3 Colombia.
    await make('2099-02-04T05:00:00.000Z');
    const completed=await make('2099-02-05T15:00Z',{status:'completed'});
    await duplicate(()=>make('2099-02-05T17:00Z'));
    const canceled=await make('2099-02-06T15:00Z',{status:'cancelled'});
    await make('2099-02-06T17:00Z');
    await make('2099-02-07T15:00Z',{status:'no_show'});await make('2099-02-07T17:00Z');
    assert(completed.id&&canceled.id);
  });
  await check('Updating date/service cannot introduce a duplicate; row is unchanged after rejection',async()=>{
    const other=await make('2099-02-08T15:00Z');
    await duplicate(()=>prisma.appointment.update({where:{id:other.id},data:{date:first.date}}));
    const sameDay=await make('2099-02-02T17:00Z',{serviceId:different.id,petId:otherPet.id});
    await duplicate(()=>prisma.appointment.update({where:{id:sameDay.id},data:{serviceId:service.id}}));
    assert.equal((await prisma.appointment.findUnique({where:{id:other.id}})).date.toISOString(),'2099-02-08T15:00:00.000Z');
  });
  for(const isolationLevel of ['ReadCommitted','RepeatableRead','Serializable']) await check('Concurrent duplicate inserts are atomic under '+isolationLevel,async()=>{
    const day={ReadCommitted:'09',RepeatableRead:'10',Serializable:'11'}[isolationLevel];
    const results=await Promise.allSettled([15,16].map(hour=>prisma.$transaction(async tx=>{await tx.appointment.count({where:{tenantId:tenant.id}});return make(`2099-02-${day}T${hour}:00Z`,{},tx);},{isolationLevel,timeout:15000})));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(await prisma.appointment.count({where:{tenantId:tenant.id,date:{gte:new Date(`2099-02-${day}T05:00Z`),lt:new Date(`2099-02-${day}T23:59Z`)}}}),1);
  });
  await check('Legacy null service identities and aliases cannot bypass the daily guard',async()=>{
    await make('2099-02-12T15:00Z',{serviceId:null,serviceType:'consultation'});
    await duplicate(()=>make('2099-02-12T16:00Z',{serviceId:different.id,serviceType:'vet'}));
  });
  const {PrismaAppointmentRepository}=require('../backend/src/contexts/agenda/infrastructure/persistence/prisma-appointment.repository');
  const {createRemoveAppointmentUseCase}=require('../backend/src/contexts/agenda/application/use-cases/remove-appointment.usecase');
  const remove=createRemoveAppointmentUseCase({repository:new PrismaAppointmentRepository(),unitOfWork:{run:fn=>prisma.$transaction(tx=>fn({tx}))}});
  const who={tenantId:tenant.id,actor:{id:'test:operator',name:'Operator',role:'admin'},reason:'Duplicate reservation created by error'};
  let retired;
  await check('Removal conserves an immutable snapshot and retries without duplicating audit',async()=>{
    const a=await make('2099-02-13T15:00Z',{status:'in_progress',startedAt:new Date('2099-02-13T15:00Z')});
    retired=a;
    const results=await Promise.all([remove({...who,appointmentId:a.id}),remove({...who,appointmentId:a.id})]);
    assert(results.every(r=>r.removed&&r.id===a.id));
    assert.equal(await prisma.appointment.count({where:{id:a.id}}),0);
    const rows=await prisma.appointmentRemoval.findMany({where:{appointmentId:a.id}});assert.equal(rows.length,1);
    assert.equal(rows[0].snapshot.petId,pet.id);assert.equal(rows[0].previousStatus,'in_progress');
    await assert.rejects(()=>prisma.appointmentRemoval.update({where:{id:rows[0].id},data:{reason:'rewrite'}}));
    await assert.rejects(()=>prisma.appointmentRemoval.delete({where:{id:rows[0].id}}));
    await assert.rejects(()=>prisma.appointment.create({data:a}));
    await make('2099-02-13T15:00Z');
  });
  await check('Removal validates tenant, operator, reason, completed attention and linked facts',async()=>{
    await assert.rejects(()=>remove({...who,tenantId:'foreign',appointmentId:retired.id}),e=>e.status===404);
    await assert.rejects(()=>remove({...who,actor:{...who.actor,role:'vet'},appointmentId:first.id}),e=>e.status===403);
    await assert.rejects(()=>remove({...who,reason:' ',appointmentId:first.id}),e=>e.status===400);
    const complete=await make('2099-02-14T15:00Z',{status:'completed'});
    await assert.rejects(()=>remove({...who,appointmentId:complete.id}),e=>e.status===409);
    const clinical=await make('2099-02-15T15:00Z');
    await prisma.medicalRecord.create({data:{petId:pet.id,appointmentId:clinical.id,type:'consultation',title:'Real record',date:clinical.date}});
    await assert.rejects(()=>remove({...who,appointmentId:clinical.id}),e=>e.status===409);
    const notes=await make('2099-02-16T15:00Z',{groomingNotes:'Care actually performed'});
    await assert.rejects(()=>remove({...who,appointmentId:notes.id}),e=>e.status===409);
    const paid=await make('2099-02-17T15:00Z');
    await prisma.transaction.create({data:{tenantId:tenant.id,appointmentId:paid.id,total:100,paymentMethod:'cash',origin:'manual'}});
    await assert.rejects(()=>remove({...who,appointmentId:paid.id}),e=>e.status===409);
    assert.equal(await prisma.appointment.count({where:{id:paid.id}}),1);
  });
  await check('A concurrent charge keeps its appointment; removal cannot detach financial facts',async()=>{
    const a=await make('2099-02-18T15:00Z');
    let entered,release;
    const ready=new Promise(resolve=>{entered=resolve}),gate=new Promise(resolve=>{release=resolve});
    const charging=prisma.$transaction(async tx=>{
      const charge=await tx.transaction.create({data:{tenantId:tenant.id,appointmentId:a.id,total:100,paymentMethod:'cash',origin:'manual'}});
      entered();await gate;return charge;
    });
    await ready;const retiring=remove({...who,appointmentId:a.id});release();await charging;
    await assert.rejects(()=>retiring,e=>e.status===409);
    assert.equal(await prisma.appointment.count({where:{id:a.id}}),1);
    assert.equal(await prisma.transaction.count({where:{appointmentId:a.id}}),1);
    assert.equal(await prisma.appointmentRemoval.count({where:{appointmentId:a.id}}),0);
  });
  await check('Failed transaction restores both reservation and absence of an audit',async()=>{
    const a=await make('2099-02-19T15:00Z');
    class FailingRepository extends PrismaAppointmentRepository {
      async removeWithAudit(...args){await super.removeWithAudit(...args);throw new Error('Controlled failure after delete');}
    }
    const failing=createRemoveAppointmentUseCase({repository:new FailingRepository(),unitOfWork:{run:fn=>prisma.$transaction(tx=>fn({tx}))}});
    await assert.rejects(()=>failing({...who,appointmentId:a.id}),/Controlled failure/);
    assert.equal(await prisma.appointment.count({where:{id:a.id}}),1);assert.equal(await prisma.appointmentRemoval.count({where:{appointmentId:a.id}}),0);
  });
};
