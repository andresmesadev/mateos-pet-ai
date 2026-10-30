jest.mock('../../lib/prisma', () => ({}));
jest.mock('../../services/ai-quota.service', () => ({ executeTenantAi: jest.fn(), isAiQuotaEnabled: () => true }));
jest.mock('../../services/audio-duration.service', () => ({ measureAudio: jest.fn(async () => ({ inputBytes: 42, durationSeconds: 61 })) }));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: () => true, statSync: () => ({ size: 42 }), createReadStream: () => 'synthetic-file' }));
jest.mock('openai', () => {
  const chat = jest.fn(async () => ({ choices: [{ finish_reason: 'stop', message: { content: '{"intent":null,"fields":{}}' } }] }));
  const embed = jest.fn(async () => ({ data: [{ embedding: Array(1536).fill(0) }] }));
  const audio = jest.fn(async () => ({ text: 'synthetic', duration: 61 }));
  const Client = jest.fn(() => ({ chat: { completions: { create: chat } }, embeddings: { create: embed }, audio: { transcriptions: { create: audio } } }));
  Client.calls = { chat,embed,audio }; return Client;
});
const OpenAI = require('openai');
const { executeTenantAi } = require('../../services/ai-quota.service');
const { runProviderScope, providerScope } = require('../../lib/provider-execution');
const { analyzeMessage,generateReply } = require('../../services/openai.service');
const { generateEmbedding } = require('../../services/embedding.service');
const { transcribeAudio } = require('../../services/audio.service');
const { buildOperationalInterpreter } = require('../../contexts/agents/infrastructure/operational/interpreter');
const operations = () => [() => analyzeMessage('synthetic'), () => generateReply({ userMessage: 'synthetic' }), () => generateEmbedding('synthetic'), () => transcribeAudio('/synthetic.ogg'), () => buildOperationalInterpreter()('synthetic','asistente_financiero')];
beforeEach(() => { jest.clearAllMocks(); });
test('all real SDK callers go through the tenant boundary and disable hidden retries', async () => {
  executeTenantAi.mockImplementation(async (_operation,_input,call) => { expect(providerScope().tenantId).toBe('a'); return call({ maxRetries: 0 }); });
  await runProviderScope({ tenantId: 'a' },async () => { for (const invoke of operations()) await invoke(); });
  expect(executeTenantAi.mock.calls.map(c => c[0])).toEqual(['analyze','reply','embedding','transcription','interpret']);
  for (const create of Object.values(OpenAI.calls)) for (const [,options] of create.mock.calls) expect(options).toEqual({ maxRetries: 0 });
  for (const [request] of OpenAI.calls.chat.mock.calls) expect(request).toMatchObject({ store: false, max_completion_tokens: 1024 });
  expect(OpenAI.calls.audio.mock.calls[0][0]).toMatchObject({ response_format: 'verbose_json' });
  const transcription = executeTenantAi.mock.calls.find(c => c[0] === 'transcription');
  expect(transcription[3]).toEqual({ inputBytes: 42, durationSeconds: 61 });
  for (const [operation, request] of executeTenantAi.mock.calls.filter(c => ['analyze','reply','interpret'].includes(c[0]))) {
    expect(request.model).toBe('gpt-4.1-mini');
    expect(request.messages.length).toBeGreaterThan(0);
    if (operation === 'interpret') expect(request.response_format.json_schema).toBeDefined();
  }
});
test('a quota rejection prevents every SDK call, including embedding, audio and interpretation', async () => {
  executeTenantAi.mockRejectedValue(Object.assign(Error('AI_QUOTA_EXHAUSTED'),{ code: 'AI_QUOTA_EXHAUSTED' }));
  await runProviderScope({ tenantId: 'a' },async () => { for (const invoke of operations()) await Promise.resolve().then(invoke).catch(() => {}); });
  expect(executeTenantAi).toHaveBeenCalledTimes(5);
  for (const create of Object.values(OpenAI.calls)) expect(create).not.toHaveBeenCalled();
});

test('invalid or oversized audio never reaches either quota reservation or the provider', async () => {
  require('../../services/audio-duration.service').measureAudio.mockRejectedValueOnce(Error('AI_AUDIO_TOO_LONG'));
  await expect(transcribeAudio('/synthetic.ogg')).resolves.toBeNull();
  expect(executeTenantAi).not.toHaveBeenCalled();
  expect(OpenAI.calls.audio).not.toHaveBeenCalled();
});
