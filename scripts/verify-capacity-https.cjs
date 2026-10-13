// Fixed production origin, authenticated reads only; no writes or provider calls.
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');
const origin = 'https://app.nexoweb.co';
const paths = ['/api/proxy/dashboard/appointments/week?date=2026-10-14',
  '/api/proxy/dashboard/cash/operational?scope=pending&pageSize=10',
  '/api/proxy/dashboard/inventory/products'];
const stages = [{ readers: 1, rounds: 2, pauseMs: 10000 },
  { readers: 3, rounds: 2, pauseMs: 20000 },
  { readers: 5, rounds: 3, pauseMs: 30000 },
  { readers: 10, rounds: 2, pauseMs: 30000 }];
const percentile = (values, fraction) => values.length
  ? [...values].sort((a, b) => a-b)[Math.min(values.length-1, Math.ceil(values.length*fraction)-1)] : null;

async function main() {
  assert(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Existing admin credentials required');
  const cookies = new Map(), starts = [], stageResults = [];
  let failed = false;
  // Reserve timestamps synchronously; cap starts below the configured 60/min/IP.
  async function pace() {
    while (true) {
      assert(!failed, 'Load stopped after an error');
      const now = Date.now();
      while (starts.length && starts[0] <= now - 61000) starts.shift();
      if (starts.length < 30) { starts.push(now); return; }
      await sleep(Math.max(10, starts[0] + 61001 - now));
    }
  }
  async function request(path, options = {}) {
    const response = await fetch(origin + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { ...options.headers, ...(cookies.size ? { Cookie: [...cookies].map(([k,v])=>k+'='+v).join('; ') } : {}) } });
    for (const raw of response.headers.getSetCookie()) {
      const pair=raw.split(';',1)[0], i=pair.indexOf('='); cookies.set(pair.slice(0,i),pair.slice(i+1));
    }
    return response;
  }
  const csrf = await request('/api/auth/csrf'); assert.equal(csrf.status,200);
  const { csrfToken } = await csrf.json();
  const login = await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email:process.env.ADMIN_EMAIL, password:process.env.ADMIN_PASSWORD, callbackUrl:origin+'/dashboard', json:'true' }) });
  assert([200,302].includes(login.status), 'Login failed');
  const session=await request('/api/auth/session'); assert.equal(session.status,200); assert.equal((await session.json()).user?.role,'admin');
  console.log(JSON.stringify({ event:'start', at:new Date().toISOString(), plannedReads:129, maxPerMinute:30, maxConcurrentReads:10 }));
  for (const stage of stages) {
    const began = Date.now(), results = [];
    for (let round=0;round<stage.rounds;round++) {
      const pending = Array.from({ length:stage.readers }, async () => {
        for (let index=0;index<paths.length;index++) {
          await pace(); const beganRead=performance.now();
          try {
            const response=await request(paths[index]);
            assert.equal(response.status,200, 'Read '+index+' HTTP '+response.status);
            const data=await response.json();
            assert(index===0 ? Array.isArray(data.appointments) : Array.isArray(data.data), 'Read contract '+index);
            results.push({ route:index, ms:performance.now()-beganRead, status:response.status });
          } catch (error) { failed=true; throw error; }
        }
      });
      const outcomes=await Promise.allSettled(pending);
      const error=outcomes.find(x=>x.status==='rejected'); if(error) throw error.reason;
      if(round+1<stage.rounds) await sleep(stage.pauseMs);
    }
    const summary={ event:'stage', at:new Date().toISOString(), readers:stage.readers,
      reads:results.length, elapsedMs:Date.now()-began, p50Ms:percentile(results.map(x=>x.ms),.5),
      p95Ms:percentile(results.map(x=>x.ms),.95), maxMs:Math.max(...results.map(x=>x.ms)),
      routes:paths.map((_,i)=>({ route:i, reads:results.filter(x=>x.route===i).length,
        p95Ms:percentile(results.filter(x=>x.route===i).map(x=>x.ms),.95) })) };
    console.log(JSON.stringify(summary)); stageResults.push(summary);
    assert(summary.p95Ms < 2000, 'P95 exceeded the agreed pilot target; stop ramp');
  }
  console.log(JSON.stringify({ event:'complete', at:new Date().toISOString(), reads:stageResults.reduce((n,x)=>n+x.reads,0),
    writes:0, providerCalls:0, result:'pass', limits:'Small production dataset, shared admin session, server-side HTTPS client; not real WhatsApp throughput.' }));
}
if (require.main===module || process.argv[1]==='-') main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports = { percentile };
