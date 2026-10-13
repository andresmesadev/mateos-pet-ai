// Run inside the deployed backend image on a dedicated --internal test network.
// Never loads .env or DATABASE_URL. Never sends to OpenAI/Meta or production DB.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { setTimeout: sleep } = require('node:timers/promises');
const connectionString=process.env.CAPACITY_TEST_DATABASE_URL;
assert(connectionString, 'Set CAPACITY_TEST_DATABASE_URL for the isolated capacity test');
const url=new URL(connectionString);
assert(url.hostname==='capacity-db' && url.pathname==='/capacity_test', 'Requires the internal capacity-db/capacity_test destination');
// Reject destinations before loading backend dependencies; the guard also runs
// in the frontend-only CI job without installing pg or generating Prisma.
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const schema='capacity_'+randomUUID().replaceAll('-','');
const admin=new Pool({ connectionString, max:2, connectionTimeoutMillis:5000 });
const pool=new Pool({ connectionString, max:10, connectionTimeoutMillis:5000, options:'-c search_path='+schema });
const prisma=new PrismaClient({ adapter:new PrismaPg(pool,{ schema }) });
const base=process.cwd()+'/src/';
require.cache[require.resolve(base+'lib/prisma')]={ exports:prisma };
const deliveries=new Map();
let delayMs=0;
require.cache[require.resolve(base+'contexts/receptionist')]={ exports:{ processIncomingMessage:async payload=>{
  await sleep(delayMs);
  return { processed:true, from:payload.sender, reply:payload.event,
    user:{ id:payload.sender, tenantId:'capacity-tenant' }, conversation:{ id:'capacity-conversation-'+payload.sender } };
} } };
require.cache[require.resolve(base+'contexts/communication')]={ exports:{ sendMessage:async reply=>{
  assert(!deliveries.has(reply.content), 'A reply was delivered more than once');
  deliveries.set(reply.content,{ sender:reply.phone, at:Date.now() });
  return { message:{ id:'capacity-only-'+reply.content } };
} } };
const queue=require(base+'services/inbound-job.service');
const { drainInboundJobs }=require(base+'jobs/inbound-message.job');
const percentile=(values,fraction)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*fraction)-1)];
const originalInfo=console.info;
console.info=()=>{}; // Worker per-turn IDs are fixtures; emit only aggregated results.

async function main(){
  await admin.query('CREATE SCHEMA "'+schema+'"');
  let created=true;
  try {
    const sql=readFileSync('/app/prisma/migrations/20260915170000_inbound_job_recovery/migration.sql','utf8');
    await pool.query(sql);
    console.log(JSON.stringify({ event:'start', at:new Date().toISOString(), productionWrites:0, externalCalls:0,
      isolation:'Dedicated internal Docker network, disposable DB, UUID schema, original worker, simulated interpretation/delivery.' }));
    for(const scenario of [{ clients:1, messages:2, delayMs:2500 },{ clients:5,messages:5,delayMs:2500 },
      { clients:10,messages:10,delayMs:2500 },{ clients:5,messages:5,delayMs:4500 },{ clients:10,messages:10,delayMs:4500 }]){
      await prisma.inboundJob.deleteMany(); deliveries.clear(); delayMs=scenario.delayMs;
      const began=Date.now(), submitted=[];
      for(let i=0;i<scenario.messages;i++){
        const event=randomUUID(),sender='capacity-sender-'+(i%scenario.clients);
        const result=await queue.enqueueInboundJob({ provider:'whatsapp',providerEventId:event,payload:{ event,sender } });
        assert(result.created);submitted.push({ id:result.job.id,event,sender,createdAt:result.job.createdAt.getTime() });
      }
      const duplicate=await queue.enqueueInboundJob({ provider:'whatsapp',providerEventId:submitted[0].event,payload:{} });
      assert.equal(duplicate.created,false);
      assert.equal(await drainInboundJobs(),scenario.messages);
      const rows=await prisma.inboundJob.findMany();
      assert.equal(rows.length,scenario.messages);
      assert(rows.every(r=>r.status==='done'&&r.phase==='complete'&&r.attempts===1&&!r.lastError&&r.leaseExpiresAt===null));
      assert.equal(deliveries.size,scenario.messages);
      for(const item of submitted)assert.equal(deliveries.get(item.event)?.sender,item.sender);
      for(let client=0;client<scenario.clients;client++){
        const ordered=submitted.filter(x=>x.sender==='capacity-sender-'+client);
        for(let i=1;i<ordered.length;i++)assert(deliveries.get(ordered[i].event).at>=deliveries.get(ordered[i-1].event).at);
      }
      const waits=submitted.map(x=>deliveries.get(x.event).at-x.createdAt);
      const result={ event:'scenario',at:new Date().toISOString(),...scenario, completed:rows.length,
        durationMs:Date.now()-began,p50Ms:percentile(waits,.5),p95Ms:percentile(waits,.95),maxMs:Math.max(...waits),
        under30SecondTarget:percentile(waits,.95)<30000,duplicates:0,externalCalls:0 };
      console.log(JSON.stringify(result));
    }
    console.log(JSON.stringify({ event:'complete',at:new Date().toISOString(), result:'integrity_pass',
      limits:'Provider delays are simulated. Larger bursts can fail the 30-second target without a data-integrity failure.' }));
  } finally {
    await prisma.$disconnect();await pool.end();
    if(created)await admin.query('DROP SCHEMA "'+schema+'" CASCADE');
    await admin.end();console.info=originalInfo;
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
