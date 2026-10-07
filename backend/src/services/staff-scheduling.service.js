const prisma = require('../lib/prisma');
const { staffWindowReason, weeklyRows } = require('../contexts/staff/domain/rules/staff-window.rules');
const { staffEditorError } = require('./staff-editor-validation.service');
const { compatibleRole, canProvideService } = require('../contexts/staff/domain/rules/service-scope.rules');

class StaffUnavailableError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; this.code = 'STAFF_UNAVAILABLE'; }
}
async function withStaffLock(staffId, run) {
  return prisma.$transaction(async tx => {
    const key = `staff-availability:${staffId}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)::text AS locked`;
    return run(tx);
  }, { timeout: 15000 });
}
async function lockStaff(tx, staffId) {
  const key = `staff-availability:${staffId}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)::text AS locked`;
}
async function loadStaff(db, staffId, tenantId) {
  return db.staff.findFirst({ where: { id: staffId, tenantId }, include: { availabilities: { include: { replacement: { select: { id: true } } } }, capabilities: true } });
}
function durationMs(service) {
  return (Number.isFinite(Number(service?.duration)) && Number(service.duration) > 0 ? Number(service.duration) : 60) * 60000;
}
async function assignmentReason(db, { staffId, tenantId, date, service, serviceType, appointmentId }) {
  const staff = await loadStaff(db, staffId, tenantId);
  if (!staff) throw new StaffUnavailableError('Profesional no encontrado en este establecimiento.', 404);
  const category = service?.category?.name || (serviceType === 'grooming' ? 'grooming' : 'veterinary');
  if (!compatibleRole(staff, category)) return 'El profesional no pertenece al área de este servicio.';
  const capabilities = staff.capabilities ?? [];
  if (!canProvideService(staff, capabilities, service?.id)) return 'El profesional no tiene habilitado este servicio.';
  const start = new Date(date), end = new Date(start.getTime() + durationMs(service));
  const reason = staffWindowReason(staff, staff.availabilities, start, end);
  if (reason) return reason;
  const others = await db.appointment.findMany({
    where: { staffId, tenantId, ...(appointmentId ? { id: { not: appointmentId } } : {}),
      status: { in: ['pending', 'confirmed', 'arrived', 'in_progress'] }, date: { lt: end } },
    select: { date: true, service: { select: { duration: true } } },
  });
  if (others.some(other => new Date(other.date).getTime() + durationMs(other.service) > start.getTime())) return 'El profesional ya tiene una atención en ese horario.';
  return null;
}
async function assertStaffAssignment(db, args) {
  const reason = await assignmentReason(db, args);
  if (reason) throw new StaffUnavailableError(reason);
}
async function saveWeeklySchedule(staffId, tenantId, availability) {
  const invalid = staffEditorError({ availability });
  if (invalid) throw new StaffUnavailableError(invalid, 400);
  await withStaffLock(staffId, async tx => {
    if (!await loadStaff(tx, staffId, tenantId)) throw new StaffUnavailableError('Integrante no encontrado.', 404);
    await tx.staffAvailability.deleteMany({ where: { staffId, type: 'base_schedule' } });
    const rows = weeklyRows(availability, staffId);
    if (rows.length) await tx.staffAvailability.createMany({ data: rows });
    await tx.staff.update({ where: { id: staffId }, data: { availability: availability === null ? require('@prisma/client').Prisma.DbNull : availability } });
  });
  await require('../contexts/staff').publishAvailabilityEvent('DisponibilidadActualizada', { staffId, tenantId, origin: 'planned', availability: { type: 'weekly_schedule', week: availability } });
}
async function changeAvailability(staffId, tenantId, data) {
  const context = require('../contexts/staff');
  const events = [];
  const result = await withStaffLock(staffId, async tx => {
    const staff = await loadStaff(tx, staffId, tenantId);
    if (!staff) throw new StaffUnavailableError('Integrante no encontrado.', 404);
    if (data.type === 'base_schedule' && staff.availability != null && !staff.availabilities.some(row => row.type === 'base_schedule')) {
      const rows = weeklyRows(staff.availability, staffId);
      if (rows.length) await tx.staffAvailability.createMany({ data: rows });
    }
    const commands = context.availabilityCommands(tx, { publish: async (name, payload) => { events.push([name, payload]); } });
    return data.type === 'unplanned_absence'
      ? commands.recordUnplannedAbsence({ staffId, tenantId, ...data.range })
      : commands.updateAvailability({ staffId, tenantId, ...data });
  });
  for (const [name, payload] of events) await context.publishAvailabilityEvent(name, payload);
  return result;
}
async function staffReview(staffId, tenantId) {
  const staff = await loadStaff(prisma, staffId, tenantId);
  if (!staff) throw new StaffUnavailableError('Integrante no encontrado.', 404);
  const appointments = await prisma.appointment.findMany({
    where: { staffId, tenantId, date: { gte: new Date() }, status: { in: ['pending', 'confirmed', 'arrived'] } },
    include: { service: { include: { category: true } }, pet: { select: { name: true } }, user: { select: { name: true } } },
    orderBy: { date: 'asc' },
  });
  const affected = [];
  for (const appointment of appointments) {
    const reason = await assignmentReason(prisma, { ...appointment, appointmentId: appointment.id });
    if (reason) affected.push({ id: appointment.id, date: appointment.date, petName: appointment.pet?.name || appointment.petName,
      ownerName: appointment.user?.name, serviceId: appointment.serviceId, serviceType: appointment.serviceType, serviceName: appointment.service?.name || appointment.serviceType, reason });
  }
  return { absences: staff.availabilities.filter(row => row.type !== 'base_schedule').sort((a,b) => new Date(b.startAt) - new Date(a.startAt)),
    affected, multipleIntervals: staff.availabilities.filter(row => row.type === 'base_schedule').some((row, i, all) => all.findIndex(other => other.weekday === row.weekday) !== i) };
}
async function correctAbsence(staffId, tenantId, data) {
  const context = require('../contexts/staff'), events = [];
  const result = await withStaffLock(staffId, async tx => context.availabilityCommands(tx, { publish: async (name,payload) => events.push([name,payload]) }).correctAbsence({ staffId, tenantId, ...data }));
  for (const [name,payload] of events) await context.publishAvailabilityEvent(name,payload);
  return result;
}
async function readServiceScope(staffId, tenantId, db = prisma) {
  const staff = await loadStaff(db,staffId,tenantId);
  if (!staff) throw new StaffUnavailableError('Integrante no encontrado.',404);
  if (!['vet','groomer','admin'].includes(staff.role)) throw new StaffUnavailableError('Este perfil no presta servicios profesionales.',422);
  const selected = staff.capabilities.filter(c=>c.active).map(c=>c.serviceId);
  const rows = await db.service.findMany({ where: { tenantId, OR: [{ active:true }, { id:{ in:selected } }] }, include:{ category:true }, orderBy:{name:'asc'} });
  return { scope: staff.serviceScope === 'auto' ? (staff.capabilities.length ? 'selected' : 'role') : staff.serviceScope,
    selected: selected.filter(id => rows.some(s => s.id === id && compatibleRole(staff,s.category.name))),
    unavailableCount: selected.filter(id => !rows.some(s => s.id === id && compatibleRole(staff,s.category.name))).length,
    services: rows.filter(s=>compatibleRole(staff,s.category.name)).map(s=>({id:s.id,name:s.name,active:s.active,category:s.category.name})) };
}
async function saveServiceScope(staffId,tenantId,{scope,serviceIds}) {
  if (!['role','selected'].includes(scope) || !Array.isArray(serviceIds) || serviceIds.length > 500 || serviceIds.some(id=>typeof id !== 'string' || !id || id.length > 200) || new Set(serviceIds).size !== serviceIds.length || (scope === 'role' && serviceIds.length)) throw new StaffUnavailableError('Selecciona un alcance y una lista de servicios válidos.',400);
  const context=require('../contexts/staff'), events=[];
  const result=await withStaffLock(staffId,async tx=>{
    const choices=await readServiceScope(staffId,tenantId,tx);
    for (const id of serviceIds) if (!choices.services.some(s=>s.id===id && (s.active || choices.selected.includes(id)))) throw new StaffUnavailableError('El servicio no está activo, no pertenece al establecimiento o no es compatible con el perfil.',422);
    const publisher={publish:async(name,payload)=>events.push([name,payload])};
    const capabilities=await context.capabilitiesCommand(tx,publisher,tenantId)({staffId,tenantId,serviceIds});
    await tx.staff.update({where:{id:staffId},data:{serviceScope:scope}});
    events.push(['DisponibilidadActualizada',{staffId,tenantId,origin:'administration',action:'service_scope',scope,serviceIds}]);
    return { ...capabilities, staff:{id:staffId,serviceScope:scope} };
  });
  for(const [name,payload] of events) await context.publishAvailabilityEvent(name,payload);
  return result;
}
module.exports = { StaffUnavailableError, withStaffLock, lockStaff, assignmentReason, assertStaffAssignment, saveWeeklySchedule, changeAvailability, staffReview, correctAbsence, readServiceScope, saveServiceScope };
