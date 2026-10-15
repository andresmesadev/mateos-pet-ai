const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const p = require('../frontend/lib/operator-channel/protocol.cjs');
const source = fs.readFileSync(path.join(__dirname,'../frontend/app/api/operator-channel/reauth/route.ts'),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({ user={email:'owner@example.test',isSuperAdmin:true}, staff={staffId:'staff-a',tenantId:'tenant-a',sessionVersion:1}, admin=true }={}) {
  const calls=[], proofs=[]; const context={exports:{},URL,AbortSignal,Response,Date,Map,console,process:{env:{AUTH_URL:'https://dashboard.example.test',API_URL:'http://backend.internal',INTERNAL_API_SECRET:'test-only'}},
    require:name=>name==='@/auth'?{auth:async()=>user?{user}:null}:name.includes('admin-auth')?{verifyAdminCredential:()=>admin?'owner@example.test':null}:name.includes('protocol.cjs')?p:
      name.includes('/authority')?{recentOperatorProof:async input=>{proofs.push(input);return {verified:true};}}:(()=>{throw Error(name);})(),
    fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(staff);}};
  vm.runInNewContext(compiled,context);
  async function request({origin='https://dashboard.example.test',body={purpose:'link_start',binding:{phone:'573001234567'},password:'disposable',tenantId:'tenant-a'}}={}) {
    const headers=new Headers();if(origin)headers.set('origin',origin);
    return context.exports.POST({headers,nextUrl:new URL('http://localhost:3001/api/operator-channel/reauth'),text:async()=>JSON.stringify(body)});
  }
  return {calls,proofs,request};
}
test('unauthenticated and cross-origin reauthentication cannot issue proofs',async()=>{
  const a=fixture({user:null});assert.equal((await a.request()).status,401);assert.equal(a.proofs.length,0);
  const b=fixture();assert.equal((await b.request({origin:'https://attacker.invalid'})).status,403);assert.equal(b.proofs.length,0);
  assert.equal((await b.request({origin:null})).status,403);
});
test('global admin can reauthenticate for the establishment resolved by the dashboard without a Staff ID',async()=>{
  const f=fixture();assert.equal((await f.request()).status,200);assert.equal(f.calls.length,0);assert.equal(f.proofs[0].principalKey,'admin:owner@example.test');assert.equal(f.proofs[0].tenantId,'tenant-a');
});
test('invalid admin password never produces a proof or delegates to staff login',async()=>{
  const f=fixture({admin:false});assert.equal((await f.request()).status,403);assert.equal(f.calls.length,0);assert.equal(f.proofs.length,0);
});
test('staff must reauthenticate their exact current identity and session version',async()=>{
  const user={email:'staff@example.test',staffId:'staff-a',tenantId:'tenant-a',sessionVersion:1,isSuperAdmin:false};
  const f=fixture({user});assert.equal((await f.request()).status,200);assert.equal(f.proofs[0].principalKey,'staff:staff-a');
  for(const staff of [{staffId:'other',tenantId:'tenant-a',sessionVersion:1},{staffId:'staff-a',tenantId:'other',sessionVersion:1},{staffId:'staff-a',tenantId:'tenant-a',sessionVersion:2}]){
    const g=fixture({user,staff});assert.equal((await g.request()).status,403);assert.equal(g.proofs.length,0);
  }
});
test('regular staff cannot select another establishment or mint execution proofs',async()=>{
  const f=fixture({user:{email:'staff@example.test',staffId:'staff-a',tenantId:'tenant-a',sessionVersion:1}});
  const body={purpose:'link_start',binding:{phone:'573001234567'},password:'test-only',tenantId:'attacker-tenant'};
  assert.equal((await f.request({body})).status,200);assert.equal(f.proofs[0].tenantId,'tenant-a');
  assert.notEqual((await f.request({body:{...body,purpose:'confirm'}})).status,200);assert.equal(f.proofs.length,1);
});
test('repeated incorrect verification is rate limited before another credential check',async()=>{
  const f=fixture({admin:false});for(let i=0;i<5;i++)assert.equal((await f.request()).status,403);assert.equal((await f.request()).status,429);
});
