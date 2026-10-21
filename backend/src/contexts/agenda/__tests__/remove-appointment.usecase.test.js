const { createRemoveAppointmentUseCase } = require('../application/use-cases/remove-appointment.usecase');
const identity = { tenantId:'t1',appointmentId:'a1',actor:{id:'admin:test',name:'Operator',role:'admin'},reason:'Wrong pet selected' };
let repo, execute;
beforeEach(()=>{
 repo={findRemoval:jest.fn().mockResolvedValue(null),lockForRemoval:jest.fn().mockResolvedValue({id:'a1',tenantId:'t1',status:'arrived'}),hasRemovalDependencies:jest.fn().mockResolvedValue(false),removeWithAudit:jest.fn().mockResolvedValue({id:'audit1'})};
 execute=createRemoveAppointmentUseCase({repository:repo,unitOfWork:{run:fn=>fn({tx:'tx'})}});
});
test('retires only the authorized row and records the reason and authenticated actor',async()=>{
 expect(await execute(identity)).toMatchObject({id:'a1',removed:true,removalId:'audit1'});
 expect(repo.lockForRemoval).toHaveBeenCalledWith('t1','a1',{tx:'tx'});
 expect(repo.removeWithAudit).toHaveBeenCalledWith(expect.objectContaining({id:'a1'}),expect.objectContaining({actor:identity.actor,reason:identity.reason}),{tx:'tx'});
});
test.each(['pending','confirmed','arrived','cancelled','no_show','in_progress'])('an erroneous %s reservation can leave agenda without erasing business facts',async status=>{
 repo.lockForRemoval.mockResolvedValue({id:'a1',tenantId:'t1',status,startedAt:status==='in_progress'?new Date():null});
 expect((await execute(identity)).removed).toBe(true);
});
test.each([{status:'completed'},{endedAt:new Date()},{groomingNotes:'Care performed'},{groomingNotesUpdatedAt:new Date()},{groomingDeliveredAt:new Date()}])('rejects care evidence %p',async change=>{
 repo.lockForRemoval.mockResolvedValue({id:'a1',tenantId:'t1',status:'arrived',...change});
 await expect(execute(identity)).rejects.toMatchObject({status:409});expect(repo.removeWithAudit).not.toHaveBeenCalled();
});
test('history, money, inventory, follow-up or a shared transfer prevent removal',async()=>{
 repo.hasRemovalDependencies.mockResolvedValue(true);
 await expect(execute(identity)).rejects.toMatchObject({status:409});expect(repo.removeWithAudit).not.toHaveBeenCalled();
});
test.each(['vet','groomer','unknown'])('rejects unauthorized role %s before touching persistence',async role=>{
 await expect(execute({...identity,actor:{...identity.actor,role}})).rejects.toMatchObject({status:403});expect(repo.findRemoval).not.toHaveBeenCalled();
});
test.each(['', ' ', 'x'.repeat(501), null])('requires an explicit bounded reason',async reason=>{
 await expect(execute({...identity,reason})).rejects.toMatchObject({status:400});expect(repo.removeWithAudit).not.toHaveBeenCalled();
});
test('tenant-scoped retry acknowledges the existing audit',async()=>{
 repo.findRemoval.mockResolvedValue({id:'audit1'});expect(await execute(identity)).toMatchObject({replayed:true});expect(repo.removeWithAudit).not.toHaveBeenCalled();
});
test('missing and foreign appointments do not leave an audit',async()=>{
 repo.lockForRemoval.mockResolvedValue(null);await expect(execute(identity)).rejects.toMatchObject({status:404});expect(repo.removeWithAudit).not.toHaveBeenCalled();
});
