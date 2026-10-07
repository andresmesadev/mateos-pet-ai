const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env'), quiet: true });
const prisma = require('../backend/src/lib/prisma');
const express = require('../backend/node_modules/express');
const request = require('../backend/node_modules/supertest');
// La prueba usa rutas/BD reales; no debe crear eventos externos de Calendar.
require('../backend/src/services/google-calendar.service').createCalendarEvent = async () => null;
const { staffWindowReason, weeklyRows } = require('../backend/src/contexts/staff/domain/rules/staff-window.rules');
const { withStaffLock, assertStaffAssignment } = require('../backend/src/services/staff-scheduling.service');
const { buildAppointmentDateTime } = require('../backend/src/services/appointment.service');

async function cleanup(ids) {
  const scope={tenantId:{in:ids}};
  await prisma.$transaction(async tx=>{
    const tenants=await tx.tenant.findMany({where:{id:{in:ids}}});
    assert(tenants.every(t=>t.slug==='staff-agenda-'+t.id && t.phone==='test-'+t.id && t.name==='Prueba de disponibilidad'));
    assert.equal(await tx.automationExecution.count({where:{domainEvent:scope}}),0);
    await tx.eventDelivery.deleteMany({where:{domainEvent:scope}});
    await tx.domainEvent.deleteMany({where:scope});
    await tx.appointment.deleteMany({where:scope});
    await tx.staffAvailability.deleteMany({where:{staff:scope}});
    await tx.staffCapability.deleteMany({where:{staff:scope}});
    await tx.staff.deleteMany({where:scope});
    await tx.pet.deleteMany({where:scope});await tx.user.deleteMany({where:scope});
    await tx.service.deleteMany({where:scope});await tx.serviceCategory.deleteMany({where:scope});
    await tx.tenant.deleteMany({where:{id:{in:ids}}});
  });
}
if (process.argv.includes('cleanup')) {
  (async()=>{const rows=await prisma.tenant.findMany({where:{slug:{startsWith:'staff-agenda-'},name:'Prueba de disponibilidad'},select:{id:true}});await cleanup(rows.map(r=>r.id));await prisma.$disconnect();console.log('PASS: limpieza de fixtures de disponibilidad identificados por UUID y marcador.');})().catch(e=>{console.error(e);process.exitCode=1;});
} else {

test('Disponibilidad: minutos, rango completo, franjas partidas y límites de ausencia', () => {
  const staff = { id: 's', active: true, availability: { mon: { active: true, open: '09:15', close: '12:10' } } };
  const at = time => `2099-01-05T${time}:00-05:00`; // lunes
  assert.equal(new Date('2099-01-05T12:00:00Z').getUTCDay(), 1);
  const reason = (a,b,rows=[]) => staffWindowReason(staff, rows, at(a), at(b));
  assert.equal(reason('09:15','12:10'), null);
  assert.match(staffWindowReason(staff, [], at('09:15'), '2099-01-05T12:10:00.001-05:00'), /fuera/, 'no se truncan segundos al comprobar el cierre');
  assert.match(reason('09:14','10:00'), /fuera/);
  assert.match(reason('11:45','12:11'), /fuera/);
  const absence = { type: 'planned_absence', startAt: at('10:00'), endAt: at('11:00') };
  assert.equal(reason('09:15','10:00',[absence]), null);
  assert.equal(reason('11:00','12:00',[absence]), null);
  assert.match(reason('09:45','10:30',[absence]), /ausencia/);
  const split = [{type:'base_schedule',weekday:1,startTime:'09:00',endTime:'12:00'}, {type:'base_schedule',weekday:1,startTime:'14:00',endTime:'18:00'}];
  assert.equal(reason('14:30','15:30',split), null);
  assert.match(reason('11:30','14:30',split), /fuera/);
  assert.equal(staffWindowReason({...staff,availability:null},[],at('09:00'),at('10:00')), null);
  assert.match(staffWindowReason({...staff,availability:{}},[],at('09:00'),at('10:00')), /fuera/);
  assert.match(staffWindowReason({...staff,active:false},[],at('09:00'),at('10:00')), /retirado/);
  assert.match(staffWindowReason(staff,[], 'invalid',at('10:00')), /válido/);
  assert.equal(weeklyRows(staff.availability,staff.id).length,1);
  console.log('PASS: límites exactos, intervalos sin solapar, ausencia parcial, semana cerrada y null, múltiples franjas, horas de Bogotá.');
});

test('Equipo + Agenda: reservas, ausencias, revisión, reasignación, concurrencia y tenant real', async () => {
  const db = new URL(process.env.DATABASE_URL);
  assert(['localhost','127.0.0.1','[::1]'].includes(db.hostname) && db.pathname === '/mateos_dev');
  const tenantId=randomUUID(), foreignId=randomUUID();
  const app=express(); app.use(express.json());
  app.use((req,_res,next)=>{req.tenant={tenantId};req.actor={type:req.get('x-role') || (req.get('x-reception')?'receptionist':'admin'),name:'Administrador de prueba'};next();});
  app.use('/api/dashboard',require('../backend/src/middleware/allowVeterinaryDashboard').allowVeterinaryDashboard);
  app.use('/api/dashboard',require('../backend/src/routes/dashboard/staff.routes'));
  app.use('/api/dashboard',require('../backend/src/routes/dashboard/appointments.routes'));
  const post=(url,data)=>request(app).post('/api/dashboard'+url).send(data);
  const patch=(url,data)=>request(app).patch('/api/dashboard'+url).send(data);
  const get=url=>request(app).get('/api/dashboard'+url);
  const put=(url,data)=>request(app).put('/api/dashboard'+url).send(data);
  const dateKey='2099-01-05';
  try {
    for(const id of [tenantId,foreignId]) await prisma.tenant.create({data:{id,slug:'staff-agenda-'+id,phone:'test-'+id,name:'Prueba de disponibilidad',activeModules:['veterinary','grooming'],businessHours:{mon:{active:true,open:'09:15',close:'18:30'}}}});
    const category=await prisma.serviceCategory.create({data:{tenantId,name:'veterinary'}});
    const service=await prisma.service.create({data:{tenantId,categoryId:category.id,name:'Consulta de prueba',duration:45,basePrice:66000}});
    const user=await prisma.user.create({data:{tenantId,name:'Propietario de prueba',phone:'test-'+randomUUID()}});
    const pet=await prisma.pet.create({data:{tenantId,ownerId:user.id,name:'Mascota de prueba',type:'dog'}});
    const a=await prisma.staff.create({data:{tenantId,name:'Veterinario de prueba A',role:'vet'}});
    const b=await prisma.staff.create({data:{tenantId,name:'Veterinario de prueba B',role:'vet'}});
    const g=await prisma.staff.create({data:{tenantId,name:'Peluquero de prueba',role:'groomer'}});
    const foreign=await prisma.staff.create({data:{tenantId:foreignId,name:'Otro tenant',role:'vet'}});
    const week={mon:{active:true,open:'09:15',close:'12:10'}};
    assert.equal((await patch('/staff/'+a.id,{availability:week})).status,200);
    assert.equal(await prisma.staffAvailability.count({where:{staffId:a.id,type:'base_schedule'}}),1);
    const slots=await get(`/appointments/available-slots?dateKey=${dateKey}&serviceId=${service.id}&staffId=${a.id}`);
    assert.equal(slots.status,200); assert(slots.body.slots.length);
    assert(slots.body.slots.every(h=>h>=9.25 && h+0.75<=12+10/60));
    const hour=slots.body.slots.find(h=>h>=10 && h<=11);assert(hour);
    const body={userId:user.id,petId:pet.id,serviceId:service.id,dateKey,hour,staffId:a.id};
    const created=await post('/appointments',body); assert.equal(created.status,201,JSON.stringify(created.body));
    const appointment=await prisma.appointment.findUniqueOrThrow({where:{id:created.body.id}});
    assert.equal(appointment.staffId,a.id);
    const start=appointment.date,end=new Date(start.getTime()+45*60000);
    const absence={type:'planned_absence',startAt:start.toISOString(),endAt:end.toISOString(),reason:'Permiso de prueba'};
    assert.equal((await post('/staff/'+a.id+'/absences',absence)).status,201);
    const review=await get('/staff/'+a.id+'/availability-review');assert.equal(review.status,200);
    assert.equal(review.body.absences.length,1);assert.equal(review.body.affected.length,1);
    assert.equal(review.body.affected[0].id,appointment.id);assert.match(review.body.affected[0].reason,/ausencia/);
    assert.equal((await prisma.appointment.findUniqueOrThrow({where:{id:appointment.id}})).status,'confirmed','schedule changes do not cancel');
    assert.equal((await patch('/appointments/'+appointment.id,{staffId:g.id})).status,409,'role cannot provide service');
    assert.equal((await patch('/appointments/'+appointment.id,{staffId:foreign.id})).status,404);
    const localTime = new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(appointment.date);
    const replacements = await get(`/staff/available?date=${dateKey}&time=${localTime}&serviceId=${service.id}&appointmentId=${appointment.id}`);
    assert.equal(replacements.status,200,JSON.stringify(replacements.body));
    assert(replacements.body.some(row=>row.id===b.id),'available replacement is returned to the editor');
    assert(!replacements.body.some(row=>[a.id,g.id,foreign.id].includes(row.id)),'absent, incompatible and foreign professionals are excluded');
    assert.equal((await patch('/appointments/'+appointment.id,{staffId:b.id})).status,200,'reassign to compatible professional');
    assert.equal((await get('/staff/'+a.id+'/availability-review')).body.affected.length,0);
    assert.equal((await patch('/appointments/'+appointment.id,{staffId:a.id})).status,409,'absence checked at write');
    assert.equal((await patch('/appointments/'+appointment.id,{staffId:null,serviceId:null})).status,200,'explicit removal clears assignment and service');
    const unassigned = await prisma.appointment.findUniqueOrThrow({where:{id:appointment.id}});
    assert.equal(unassigned.staffId,null);assert.equal(unassigned.serviceId,null);
    assert.equal((await patch('/appointments/'+appointment.id,{staffId:b.id,serviceId:service.id})).status,200,'restore assignment with the selected service');
    // Una reasignación no puede guardar la disponibilidad de un servicio que
    // cambió mientras esperaba el lock del profesional nuevo.
    const specialist=await prisma.staff.create({data:{tenantId,name:'Especialista de prueba',role:'vet',serviceScope:'selected'}});
    await prisma.staffCapability.create({data:{staffId:specialist.id,serviceId:service.id}});
    const otherService=await prisma.service.create({data:{tenantId,categoryId:category.id,name:'Otro servicio de prueba',duration:90}});
    let unlockSpecialist, specialistLocked, snapshotRead;
    const lockedPromise=new Promise(resolve=>specialistLocked=resolve);
    const unlockPromise=new Promise(resolve=>unlockSpecialist=resolve);
    const snapshotPromise=new Promise(resolve=>snapshotRead=resolve);
    const specialistHolding=withStaffLock(specialist.id,async()=>{specialistLocked();await unlockPromise;});
    await lockedPromise;
    const findAppointment=prisma.appointment.findFirst;
    prisma.appointment.findFirst=async function(args) {
      const row=await findAppointment.call(this,args);
      if(args.where?.id===appointment.id) snapshotRead();
      return row;
    };
    let delayedAssignment;
    try {
      delayedAssignment=patch('/appointments/'+appointment.id,{staffId:specialist.id}).then(response=>response);
      await snapshotPromise;
      prisma.appointment.findFirst=findAppointment;
      assert.equal((await patch('/appointments/'+appointment.id,{serviceId:otherService.id})).status,200);
    } finally {
      prisma.appointment.findFirst=findAppointment;
      unlockSpecialist();await specialistHolding;
    }
    assert.equal((await delayedAssignment).status,409,'stale service validation cannot assign an incompatible specialist');
    const concurrentResult=await prisma.appointment.findUniqueOrThrow({where:{id:appointment.id}});
    assert.equal(concurrentResult.staffId,b.id);assert.equal(concurrentResult.serviceId,otherService.id);
    assert.equal((await patch('/appointments/'+appointment.id,{serviceId:service.id})).status,200);
    console.log('PASS: cambio simultáneo de servicio y profesional conserva la asignación válida y rechaza la validación antigua con 409.');
    assert.equal((await post('/staff/'+a.id+'/absences',{...absence,type:'unplanned_absence',startAt:'not-a-date'})).status,400);
    assert.equal((await get('/staff/'+foreign.id+'/availability-review')).status,404);
    assert.equal((await request(app).get('/api/dashboard/staff/'+a.id+'/availability-review').set('x-reception','1')).status,403);
    assert.equal((await request(app).get(`/api/dashboard/staff/available?date=${dateKey}&time=16:00&serviceId=${service.id}`).set('x-reception','1')).status,200);
    assert.equal((await patch('/staff/'+b.id,{availability:{mon:{active:true,open:'14:00',close:'18:00'}}})).status,200);
    assert.equal((await get('/staff/'+b.id+'/availability-review')).body.affected.length,1,'changed week flags existing visit');
    assert.equal((await patch('/staff/'+b.id,{availability:null})).status,200);
    assert.equal((await patch('/staff/'+b.id,{active:false})).status,200);
    assert.match((await get('/staff/'+b.id+'/availability-review')).body.affected[0].reason,/retirado/);
    assert.equal((await patch('/staff/'+a.id,{availability:null})).status,200);
    assert.equal(await prisma.staffAvailability.count({where:{staffId:a.id,type:'base_schedule'}}),0);
    assert.equal(await prisma.staffAvailability.count({where:{staffId:a.id,type:'planned_absence'}}),1,'reset preserves absences');
    const newSlots=await get(`/appointments/available-slots?dateKey=${dateKey}&serviceId=${service.id}&staffId=${a.id}`);
    assert(!newSlots.body.slots.includes(hour),'selected professional absence removed from offered slots');
    const raceDate=buildAppointmentDateTime(dateKey,16);
    let entered,release;const enteredPromise=new Promise(r=>entered=r),releasePromise=new Promise(r=>release=r);
    const holding=withStaffLock(a.id,async tx=>{await tx.staffAvailability.create({data:{staffId:a.id,type:'unplanned_absence',startAt:raceDate,endAt:new Date(raceDate.getTime()+3600000),reason:'Concurrencia de prueba'}});entered();await releasePromise;});
    await enteredPromise;
    const racing=post('/appointments',{...body,hour:16}).then(r=>r);
    release();await holding;
    assert.equal((await racing).status,409,'new booking rechecks absence after lock release');
    await withStaffLock(a.id,async tx=>{
      await assert.rejects(assertStaffAssignment(tx,{tenantId,staffId:a.id,date:raceDate,service:{...service,category}}),/ausencia/);
    });
    const stored=await prisma.appointment.findUniqueOrThrow({where:{id:appointment.id}});
    assert.equal(stored.date.toISOString(),appointment.date.toISOString());assert.equal(stored.status,appointment.status);
    const first=review.body.absences[0];
    const changeUrl='/staff/'+a.id+'/absences/'+first.id+'/change';
    assert.equal((await post(changeUrl,{action:'void',changeReason:' '})).status,400);
    assert.equal((await post('/staff/'+b.id+'/absences/'+first.id+'/change',{action:'void',changeReason:'Prueba'})).status,404);
    const changed=await post(changeUrl,{action:'correct',changeReason:'Fecha equivocada',author:'Falsificado',range:{startAt:'2099-01-05T14:00:00-05:00',endAt:'2099-01-05T15:00:00-05:00',reason:'Nuevo permiso'}});
    assert.equal(changed.status,200,JSON.stringify(changed.body));
    const original=await prisma.staffAvailability.findUniqueOrThrow({where:{id:first.id}});
    assert.equal(original.reason,'Permiso de prueba');assert.equal(original.startAt.toISOString(),start.toISOString());
    assert.equal(original.voidedBy,'Administrador de prueba');assert.equal(original.voidReason,'Fecha equivocada');assert(original.voidedAt);
    const correction=changed.body.replacement;assert.equal(correction.replacesId,first.id);
    const rows=await prisma.staffAvailability.findMany({where:{staffId:a.id}});
    assert.equal(staffWindowReason({...a,availability:null},rows,start,end),null,'voided original does not block');
    assert.match(staffWindowReason({...a,availability:null},rows,'2099-01-05T14:15:00-05:00','2099-01-05T14:45:00-05:00'),/ausencia/);
    assert.equal((await post(changeUrl,{action:'void',changeReason:'Repetido'})).status,409);
    const competing=await Promise.all([1,2].map(n=>post('/staff/'+a.id+'/absences/'+correction.id+'/change',{action:'correct',changeReason:'Corrección '+n,range:{startAt:'2099-01-05T15:00:00-05:00',endAt:'2099-01-05T15:30:00-05:00'}})));
    assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
    assert.equal(await prisma.staffAvailability.count({where:{replacesId:correction.id}}),1);
    const last=competing.find(r=>r.status===200).body.replacement;
    assert.equal((await post('/staff/'+a.id+'/absences/'+last.id+'/change',{action:'void',changeReason:'Permiso cancelado'})).status,200);
    const audited=await get('/staff/'+a.id+'/availability-review');
    assert.equal(audited.body.absences.find(r=>r.id===first.id).replacement.id,correction.id);
    const splitWeek={mon:{active:true,open:'09:15',close:'18:00',windows:[{open:'09:15',close:'12:10'},{open:'14:15',close:'18:00'}]}};
    assert.equal((await patch('/staff/'+a.id,{availability:splitWeek})).status,200);
    assert.equal(await prisma.staffAvailability.count({where:{staffId:a.id,type:'base_schedule'}}),2);
    assert.deepEqual((await get('/staff')).body.find(r=>r.id===a.id).availability.mon.windows,splitWeek.mon.windows);
    const splitSlots=await get(`/appointments/available-slots?dateKey=${dateKey}&serviceId=${service.id}&staffId=${a.id}`);
    assert.equal(splitSlots.status,200);assert(splitSlots.body.slots.every(h=>h+0.75<=12+10/60 || h>=14.25),'no appointments across lunch gap');
    const overlap={mon:{active:true,windows:[{open:'09:00',close:'12:00'},{open:'11:30',close:'14:00'}]}};
    assert.equal((await patch('/staff/'+a.id,{availability:overlap})).status,400);
    assert.equal(await prisma.staffAvailability.count({where:{staffId:a.id,type:'base_schedule'}}),2);
    assert.equal((await put('/staff/'+a.id+'/services',{scope:'selected',serviceIds:[]})).status,200);
    assert.equal((await get(`/staff/available?date=${dateKey}&time=11:00&serviceId=${service.id}`)).body.some(s=>s.id===a.id),false);
    assert.equal((await put('/staff/'+g.id+'/services',{scope:'selected',serviceIds:[service.id]})).status,422);
    const foreignCategory=await prisma.serviceCategory.create({data:{tenantId:foreignId,name:'veterinary'}});
    const foreignService=await prisma.service.create({data:{tenantId:foreignId,categoryId:foreignCategory.id,name:'Servicio ajeno',duration:30}});
    assert.equal((await put('/staff/'+a.id+'/services',{scope:'selected',serviceIds:[foreignService.id]})).status,422);
    const retiredService=await prisma.service.create({data:{tenantId,categoryId:category.id,name:'Servicio retirado',duration:30,active:false}});
    assert.equal((await put('/staff/'+a.id+'/services',{scope:'selected',serviceIds:[retiredService.id]})).status,422);
    assert.equal(await prisma.staffCapability.count({where:{staffId:a.id}}),0,'invalid scope changes are rolled back');
    assert.equal((await put('/staff/'+foreign.id+'/services',{scope:'role',serviceIds:[]})).status,404);
    const selection=await put('/staff/'+a.id+'/services',{scope:'selected',serviceIds:[service.id]});assert.equal(selection.status,200,JSON.stringify(selection.body));
    const cap=await prisma.staffCapability.findFirstOrThrow({where:{staffId:a.id,serviceId:service.id,active:true}});
    assert.equal((await put('/staff/'+a.id+'/services',{scope:'role',serviceIds:[]})).status,200);
    assert.equal((await prisma.staffCapability.findUniqueOrThrow({where:{id:cap.id}})).active,false,'revoked capability is preserved');
    assert.equal((await put('/staff/'+a.id+'/services',{scope:'selected',serviceIds:[service.id]})).status,200);
    assert.equal(await prisma.staffCapability.count({where:{staffId:a.id,active:true}}),1);
    await put('/staff/'+a.id+'/services',{scope:'role',serviceIds:[]});
    const resolved=await require('../backend/src/contexts/staff').resolveStaffAvailability({tenantId,serviceId:service.id,rangeStart:new Date('2099-01-05T11:00:00-05:00'),rangeEnd:new Date('2099-01-05T11:45:00-05:00'),timeZone:'America/Bogota'});
    assert(resolved.availableStaff.some(s=>s.id===a.id),'canonical domain resolver includes explicit role scope');
    for(const actor of ['receptionist','vet','groomer']) {
      for(const suffix of ['/services','/availability-review']) assert.equal((await request(app).get('/api/dashboard/staff/'+a.id+suffix).set('x-role',actor)).status,403);
      assert.equal((await request(app).put('/api/dashboard/staff/'+a.id+'/services').set('x-role',actor).send({scope:'role',serviceIds:[]})).status,403);
      assert.equal((await request(app).post('/api/dashboard'+changeUrl).set('x-role',actor).send({action:'void',changeReason:'Prohibido'})).status,403);
    }
    console.log('PASS ADR 018: corrección y anulación auditadas, autor autenticado, concurrencia 200/409, historial intacto, franjas con descanso, servicios seleccionados/vacíos/por perfil, capacidades revocadas conservadas, resolver canónico y tres perfiles sin permisos administrativos.');
    console.log('PASS: horario completo, slots filtrados, creación con profesional, ausencias programadas/imprevistas, revisión de citas, reasignación, retiro, reset sin perder ausencias, aislamiento y permisos; reserva concurrente bloqueada sin modificar citas existentes.');
  } catch(error) { console.error('TEST FAILED:',error.stack);throw error; } finally {
    await cleanup([tenantId,foreignId]);
    await prisma.$disconnect();console.log('PASS: todas las filas de prueba eliminadas; datos del negocio conservados.');
  }
});
}
