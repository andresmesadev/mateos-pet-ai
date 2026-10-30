jest.mock('../../lib/prisma', () => ({}));
const { meterOperation, transcriptionDurationConfirmed } = require('../ai-metering.service');
const { aiQuotaPolicy } = require('../ai-quota.service');
const env = { AI_QUOTA_POLICY_VERSION: 'initial', AI_OPERATION_UNITS_JSON: JSON.stringify({ analyze: 1, reply: 1, embedding: 1, transcription: 5, interpret: 1 }) };

test.each([[0.001,5], [59.999,5], [60,5], [60.001,10], [61,10], [120,10], [600,50]])('audio %s seconds reserves %s credits', (durationSeconds, units) => {
  expect(meterOperation('transcription', { inputBytes: 1200, durationSeconds }, 5)).toMatchObject({ units, meter: { basis: 'started_minutes' } });
});
test.each([undefined,null,NaN,Infinity,0,-1,'60'])('audio without a positive numeric duration is refused: %s', durationSeconds => {
  expect(() => meterOperation('transcription', { durationSeconds },5)).toThrow('AI_AUDIO_DURATION_REQUIRED');
});
test('overlong and oversized audio fail before a reservation', () => {
  expect(() => meterOperation('transcription', { durationSeconds: 600.001 },5)).toThrow('AI_AUDIO_TOO_LONG');
  expect(() => meterOperation('transcription', { durationSeconds: 1, inputBytes: 20*1024*1024+1 },5)).toThrow('AI_INPUT_TOO_LARGE');
});
test.each(['analyze','reply','interpret'])('%s charges the entire serialized context in started blocks', operation => {
  expect(meterOperation(operation,{ inputBytes: 4000 },1).units).toBe(1);
  expect(meterOperation(operation,{ inputBytes: 4001 },1).units).toBe(2);
  expect(meterOperation(operation,{ inputBytes: 128000 },1).units).toBe(32);
  expect(() => meterOperation(operation,{ inputBytes: 128001 },1)).toThrow('AI_INPUT_TOO_LARGE');
});
test('embedding retains one weighted call and its bounded input', () => {
  expect(meterOperation('embedding',{ inputBytes: 8000 },2).units).toBe(2);
  expect(() => meterOperation('embedding',{ inputBytes: 8001 },1)).toThrow('AI_INPUT_TOO_LARGE');
});
test('provider duration is evidence, and missing or contradictory evidence is not refunded', () => {
  expect(transcriptionDurationConfirmed({ duration: 60.5 },60)).toBe(true);
  expect(transcriptionDurationConfirmed({ duration: 62 },60)).toBe(false);
  expect(transcriptionDurationConfirmed({ duration: 0 },60)).toBe(false);
  expect(transcriptionDurationConfirmed({},60)).toBe(false);
});
test('policy fingerprints protect an open month against changed weights with the same label', () => {
  const first = aiQuotaPolicy(env), units = JSON.parse(env.AI_OPERATION_UNITS_JSON);
  expect(first.version).toMatch(/^initial\.m2\.[a-f0-9]{12}$/);
  expect(aiQuotaPolicy({ ...env, AI_OPERATION_UNITS_JSON: JSON.stringify({ ...units, transcription: 6 }) }).version).not.toBe(first.version);
  expect(aiQuotaPolicy({ ...env, AI_OPERATION_UNITS_JSON: JSON.stringify(Object.fromEntries(Object.entries(units).reverse())) }).version).toBe(first.version);
});
