const p = require('../protocol');
const frontend = require('../../../../../frontend/lib/operator-channel/protocol.cjs');
const { randomBytes } = require('node:crypto');
const key = randomBytes(40).toString('hex');
test('frontend and backend protocol implementations remain identical', () => {
  const fs = require('node:fs'); const path = require('node:path');
  expect(fs.readFileSync(path.join(__dirname,'../protocol.js'),'utf8').trim()).toBe(fs.readFileSync(path.join(__dirname,'../../../../../frontend/lib/operator-channel/protocol.cjs'),'utf8').trim());
  const envelope = p.sign(key,'v1','access',{ tenantId:'t',amount:2 });
  expect(frontend.verify(key,'v1',envelope,'access').body).toEqual({ tenantId:'t',amount:2 });
});
test('signature rejects tampering, wrong purpose, unknown fields, future and expired claims', () => {
  const at = new Date(); const e = p.sign(key,'v1','access',{ principalKey:'staff:x' },30000,at);
  for (const envelope of [{ ...e, body:{ principalKey:'staff:y' } },{ ...e, purpose:'confirm' },{ ...e, extra:true }]) expect(()=>p.verify(key,'v1',envelope,'access',30000,at)).toThrow();
  expect(()=>p.verify(key,'v1',e,'access',30000,new Date(+at+30000))).toThrow();
  expect(()=>p.verify(key,'v1',e,'access',30000,new Date(+at-6000))).toThrow();
  expect(()=>p.verify(key,'v1',e,'confirm')).toThrow();
});
