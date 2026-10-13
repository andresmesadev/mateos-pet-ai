jest.mock('../../lib/prisma',()=>({
  tenant:{ findUnique:jest.fn().mockResolvedValue({ active:true }) },
  staffCredential:{ findFirst:jest.fn(async ({where})=>where.active&&where.sessionVersion===1
    ?{ staffId:where.staffId,staff:{ role:'receptionist',name:'Capacity fixture',accessPermissions:[] } }:null) },
}));
const express=require('express');
const request=require('supertest');
const { resolveTenant }=require('../../middleware/resolveTenant');
const { createDashboardRateLimits }=require('../../middleware/rateLimit');
const prisma=require('../../lib/prisma');
let prior;
beforeEach(()=>{
  prior={ NODE_ENV:process.env.NODE_ENV,INTERNAL_API_SECRET:process.env.INTERNAL_API_SECRET,SINGLE_TENANT_ID:process.env.SINGLE_TENANT_ID };
  process.env.NODE_ENV='production';process.env.INTERNAL_API_SECRET='capacity-test-only';delete process.env.SINGLE_TENANT_ID;
  prisma.tenant.findUnique.mockResolvedValue({ active:true });
});
afterEach(()=>{for(const [key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
const build=()=>{
  const app=express(),limits=createDashboardRateLimits();
  app.use(limits.dashboardProxyRateLimit,resolveTenant,limits.dashboardRateLimit);
  app.get('/read',(_req,res)=>res.json({ok:true}));
  return app;
};
const read=(app,id,tenant='capacity-tenant')=>request(app).get('/read')
  .set('X-Internal-Token','capacity-test-only').set('X-Tenant-Id',tenant)
  .set('X-Staff-Id',id).set('X-Staff-Session-Version','1');

test('three validated operators sharing one proxy IP have independent dashboard budgets',async()=>{
  const app=build();
  for(let round=0;round<21;round++)for(const id of ['capacity-a','capacity-b','capacity-c'])await read(app,id).expect(200);
});

test('one actor remains limited to 60 even across tabs; another actor and tenant keep their budget',async()=>{
  const app=build();for(let i=0;i<60;i++)await read(app,'capacity-a').expect(200);
  await read(app,'capacity-a').expect(429);
  await read(app,'capacity-b').expect(200);
  await read(app,'capacity-a','other-capacity-tenant').expect(200);
});

test('raw identity headers cannot bypass authentication or the 60/min unauthenticated IP cap',async()=>{
  const app=build();for(let i=0;i<60;i++)await request(app).get('/read')
    .set('X-Internal-Token','invalid').set('X-Staff-Id','spoof-'+i).set('X-Tenant-Id','spoof-'+i).expect(401);
  await request(app).get('/read').set('X-Internal-Token','invalid').set('X-Staff-Id','another-spoof').expect(429);
});

test('trusted ingress is still capped at 300 despite rotating validated actor identities',async()=>{
  const app=build();for(let i=0;i<300;i++)await read(app,'capacity-'+i).expect(200);
  await read(app,'capacity-another').expect(429);
});

test('suspension and revoked staff credentials are still rejected before actor budget',async()=>{
  const app=build();prisma.tenant.findUnique.mockResolvedValueOnce({active:false});
  await read(app,'capacity-a').expect(402);
  await request(app).get('/read').set('X-Internal-Token','capacity-test-only').set('X-Tenant-Id','capacity-tenant')
    .set('X-Staff-Id','capacity-a').set('X-Staff-Session-Version','2').expect(403);
});

test('admin tabs share a normalized identity budget while a second admin stays independent',async()=>{
  const app=build();
  for(let i=0;i<60;i++)await request(app).get('/read').set('X-Internal-Token','capacity-test-only')
    .set('X-Tenant-Id','capacity-tenant').set('X-Admin-Email',i%2?'OPERATOR@fixture.invalid':'operator@fixture.invalid').expect(200);
  await request(app).get('/read').set('X-Internal-Token','capacity-test-only').set('X-Tenant-Id','capacity-tenant')
    .set('X-Admin-Email','operator@fixture.invalid').expect(429);
  await request(app).get('/read').set('X-Internal-Token','capacity-test-only').set('X-Tenant-Id','capacity-tenant')
    .set('X-Admin-Email','another@fixture.invalid').expect(200);
});

test('missing principal falls back to an IP budget instead of accepting arbitrary headers',async()=>{
  const app=build();
  for(let i=0;i<60;i++)await request(app).get('/read').set('X-Internal-Token','capacity-test-only')
    .set('X-Tenant-Id','capacity-tenant').set('X-Operator-Id','unverified-'+i).expect(200);
  await request(app).get('/read').set('X-Internal-Token','capacity-test-only').set('X-Tenant-Id','capacity-tenant')
    .set('X-Operator-Id','another-unverified').expect(429);
});

test('a missing internal secret still fails closed',async()=>{
  const app=build();delete process.env.INTERNAL_API_SECRET;
  await read(app,'capacity-a').expect(500);
});
