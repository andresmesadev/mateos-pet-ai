// CI-only explicit disposable database; no implicit application connection.
const assert=require('node:assert/strict');
const value=process.env.APPOINTMENT_LIFECYCLE_TEST_DATABASE_URL;
assert(value&&process.env.NODE_ENV==='test','Explicit test database and NODE_ENV=test required');
const url=new URL(value);
assert(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/mateos_dev','Only the isolated CI database is supported');
process.env.DATABASE_URL=value;
const prisma=require('../backend/src/lib/prisma');
let passed=0;
require('./verify-appointment-lifecycle-scenario.cjs')({prisma,check:async(label,fn)=>{await fn();passed++;console.log('PASS '+label)}})
 .then(()=>console.log(`Appointment lifecycle: ${passed} passed, 0 failed. CI disposable database only.`))
 .catch(error=>{console.error(error.code||error.name,error.message);process.exitCode=1})
 .finally(()=>prisma.$disconnect());
