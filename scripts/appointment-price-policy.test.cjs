const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../frontend/lib/appointments.ts'), 'utf8');
const result = { exports: {} };
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(result, result.exports);
const { isGroomingAppointment, appointmentNeedsReview } = result.exports;

test('missing clinical/vaccination prices do not create an Agenda price warning; grooming does', () => {
  for (const serviceCategory of ['veterinary', 'other', 'grooming']) {
    const visit = { serviceCategory, serviceType: 'grooming', status: 'confirmed', staffName: 'Professional', finalPrice: null };
    assert.equal(isGroomingAppointment(visit), serviceCategory === 'grooming');
    assert.equal(appointmentNeedsReview(visit), serviceCategory === 'grooming');
    assert.equal(appointmentNeedsReview({ ...visit, status: 'in_progress' }), true);
  }
});

test('legacy grooming type is recognized when there is no category, and zero remains a resolved price', () => {
  assert.equal(isGroomingAppointment({ serviceType: 'bath_grooming' }), true);
  assert.equal(isGroomingAppointment({ serviceType: 'vacunacion' }), false);
  assert.equal(appointmentNeedsReview({ serviceCategory: 'grooming', status: 'confirmed', staffName: 'Professional', finalPrice: 0 }), false);
});
