const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const React = require('../frontend/node_modules/react');
const { NextResponse } = require('../frontend/node_modules/next/server');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let now = 100000, cursor = 0, tenant = null;
  const slots = [], effects = [], listeners = new Map(), timers = new Map(), requests = [], redirects = [];
  let timerId = 0;
  const depsEqual = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
  const hooks = {
    ...React,
    useState(initial) { const slot = cursor++; if (!slots[slot]) slots[slot] = { value: initial }; return [slots[slot].value, value => { slots[slot].value = typeof value === 'function' ? value(slots[slot].value) : value; }]; },
    useRef(initial) { const slot = cursor++; if (!slots[slot]) slots[slot] = { current: initial }; return slots[slot]; },
    useCallback(fn,deps) { const slot = cursor++; if (!slots[slot] || !depsEqual(slots[slot].deps,deps)) slots[slot] = { fn,deps }; return slots[slot].fn; },
    useEffect(fn,deps) { const slot = cursor++; if (!slots[slot] || !depsEqual(slots[slot].deps,deps)) { const old = slots[slot]; slots[slot] = { deps,cleanup:undefined }; effects.push(() => { old?.cleanup?.(); slots[slot].cleanup = fn(); }); } },
  };
  const router = { replace: value => redirects.push(value) };
  const navigator = { onLine: true };
  const fetch = (url,options) => new Promise((resolve,reject) => requests.push({url,options,resolve,reject}));
  const addTimer = (fn,ms,interval) => { timers.set(++timerId,{fn,ms,interval,at:now+ms}); return timerId; };
  const Recovery = () => null;
  const context = { exports:{}, fetch, navigator, AbortController,
    Date: class extends Date { static now() { return now; } },
    setTimeout:(fn,ms)=>addTimer(fn,ms,false),clearTimeout:id=>timers.delete(id),
    setInterval:(fn,ms)=>addTimer(fn,ms,true),clearInterval:id=>timers.delete(id),
    window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}},
    require:name=>{
      if(name==='react')return hooks;
      if(name==='react/jsx-runtime')return require('../frontend/node_modules/react/jsx-runtime');
      if(name==='next/navigation')return {useSearchParams:()=>({get:()=>tenant}),useRouter:()=>router};
      if(name==='@/lib/api')return {proxyUrl:value=>value};
      if(name==='@/components/auth/session-recovery')return {SessionRecovery:Recovery};
      throw Error(name);
    },
  };
  vm.runInNewContext(compile('frontend/components/dashboard/dashboard-access-provider.tsx'),context);
  const child=React.createElement('section',{id:'workspace'},'unsaved draft');
  function render() {cursor=0;return context.exports.DashboardAccessProvider({children:child});}
  function mount(){const tree=render();while(effects.length)effects.shift()();return tree;}
  return {requests,redirects,navigator,Recovery,child,render,mount,
    event:name=>listeners.get(name)?.(),
    advance(ms){now+=ms;for(const [id,timer]of [...timers])if(timer.at<=now){if(timer.interval)timer.at=now+timer.ms;else timers.delete(id);timer.fn();}},
    changeTenant(value){tenant=value;},
    unmount(){for(const slot of slots)slot?.cleanup?.();},
  };
}
const manifest={role:'vet',navigation:['/dashboard'],capabilities:{clinical:true}};
async function authenticated() {const f=fixture();f.mount();f.requests[0].resolve(Response.json(manifest));await settle();return f;}
const containsWorkspace=f=>f.render().props.children?.includes(f.child)===true;

test('429 preserves the workspace and respects Retry-After across repeated focus events',async()=>{
  const f=await authenticated();assert(containsWorkspace(f));f.advance(30000);assert.equal(f.requests.length,2);
  f.requests[1].resolve(new Response('busy',{status:429,headers:{'Retry-After':'60'}}));await settle();assert(containsWorkspace(f));assert.equal(f.redirects.length,0);
  for(let i=0;i<10;i++)f.event('focus');assert.equal(f.requests.length,2);
  f.advance(30000);assert.equal(f.requests.length,2);f.advance(30000);assert.equal(f.requests.length,3);
  f.requests[2].resolve(Response.json(manifest));await settle();assert(containsWorkspace(f));assert.equal(f.render().props.children[0],false);f.unmount();
});
test('503, network loss and offline/online recovery keep the mounted draft',async()=>{
  const f=await authenticated();f.advance(30000);f.requests[1].resolve(new Response('',{status:503}));await settle();assert(containsWorkspace(f));
  f.advance(30000);f.requests[2].reject(Error('network'));await settle();assert(containsWorkspace(f));
  f.navigator.onLine=false;f.event('offline');f.advance(30000);assert.equal(f.requests.length,3);assert(containsWorkspace(f));
  f.navigator.onLine=true;f.event('online');assert.equal(f.requests.length,4);f.requests[3].resolve(Response.json(manifest));await settle();assert(containsWorkspace(f));assert.equal(f.redirects.length,0);f.unmount();
});
test('initial unavailable access does not render any protected workspace',async()=>{
  const f=fixture();f.mount();f.requests[0].resolve(new Response('',{status:503}));await settle();assert.equal(f.render().type,f.Recovery);assert(!containsWorkspace(f));f.unmount();
});
test('a stalled permission request times out without discarding an existing form',async()=>{
  const f=await authenticated();f.advance(30000);f.advance(15000);assert.equal(f.requests[1].options.signal.aborted,true);
  f.requests[1].reject(Error('aborted'));await settle();assert(containsWorkspace(f));assert.equal(f.redirects.length,0);
  f.advance(15000);assert.equal(f.requests.length,3);f.requests[2].resolve(Response.json(manifest));await settle();assert(containsWorkspace(f));f.unmount();
});
for(const status of [401,403])test('actual session rejection '+status+' immediately hides data and stops further polling',async()=>{
  const f=await authenticated();f.advance(30000);f.requests[1].resolve(new Response('',{status}));await settle();assert(!containsWorkspace(f));assert.deepEqual(f.redirects,['/session-recovery?reason=session']);f.advance(60000);f.event('focus');assert.equal(f.requests.length,2);f.unmount();
});
test('commercial suspension still removes protected content',async()=>{
  const f=await authenticated();f.advance(30000);f.requests[1].resolve(new Response('',{status:402}));await settle();assert.equal(f.render().type,f.Recovery);assert(!containsWorkspace(f));assert.deepEqual(f.redirects,['/dashboard/billing']);f.advance(60000);f.event('focus');assert.equal(f.requests.length,2);f.unmount();
});
test('focus and online bursts are single-flight and tenant changes discard stale responses',async()=>{
  const f=fixture();f.mount();for(let i=0;i<12;i++){f.event('focus');f.event('online');}assert.equal(f.requests.length,1);
  f.changeTenant('another-tenant');assert(!containsWorkspace(f));f.mount();assert.equal(f.requests.length,2);assert.equal(f.requests[0].options.signal.aborted,true);
  f.requests[0].resolve(Response.json(manifest));await settle();assert(!containsWorkspace(f));
  f.requests[1].resolve(Response.json({...manifest,role:'receptionist'}));await settle();assert(containsWorkspace(f));assert(f.requests[1].url.includes('another-tenant'));f.unmount();
});
test('tenant changes never expose the previous tenant manifest for one render',async()=>{
  const f=await authenticated();f.changeTenant('new');assert(!containsWorkspace(f));f.mount();assert(!containsWorkspace(f));f.unmount();
});
test('access proxy forwards Retry-After and marks permission responses no-store',async()=>{
  const context={exports:{},process:{env:{INTERNAL_API_SECRET:'fixture-only',API_URL:'http://fixture.invalid'}},URL,AbortSignal,Response,
    fetch:async()=>new Response('busy',{status:429,headers:{'Retry-After':'42'}}),
    require:name=>name==='@/auth'?{auth:async()=>({user:{staffId:'fixture',tenantId:'tenant',sessionVersion:2}})}:name==='next/server'?{NextResponse}:(()=>{throw Error(name)})()};
  vm.runInNewContext(compile('frontend/app/api/proxy/dashboard/[...path]/route.ts'),context);
  const response=await context.exports.GET({method:'GET',headers:new Headers(),nextUrl:new URL('https://fixture.invalid/api/proxy/dashboard/access'),signal:new AbortController().signal},{params:Promise.resolve({path:['access']})});
  assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'42');assert.equal(response.headers.get('Cache-Control'),'no-store');
});
