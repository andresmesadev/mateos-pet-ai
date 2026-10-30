// Scenario calculator only: no credentials, network, production usage, taxes or invoices.
const { meterOperation, TEXT_BLOCK_BYTES, MAX_COMPLETION_TOKENS } = require('../../backend/src/services/ai-metering.service');
const rates = Object.freeze({ textInputPerMillion: .40, textOutputPerMillion: 1.60, embeddingPerMillion: .02, audioPerMinute: .006 });
function costUsd({ operation, inputTokens = 0, outputTokens = 0, durationSeconds = 0 }) {
  if (!['analyze','reply','interpret','embedding','transcription'].includes(operation)) throw Error('INVALID_COST_SCENARIO');
  for (const n of [inputTokens,outputTokens,durationSeconds]) if (!Number.isFinite(n) || n < 0) throw Error('INVALID_COST_SCENARIO');
  if (operation === 'transcription') return Math.ceil(durationSeconds) / 60 * rates.audioPerMinute;
  if (operation === 'embedding') return inputTokens * rates.embeddingPerMillion / 1000000;
  return (inputTokens * rates.textInputPerMillion + outputTokens * rates.textOutputPerMillion) / 1000000;
}
function scenario(name, input) {
  const units = meterOperation(input.operation,{ inputBytes: input.inputBytes, durationSeconds: input.durationSeconds },input.operation === 'transcription' ? 5 : 1).units;
  const usd = costUsd(input);
  return { name, credits: units, providerUsd: usd, copAt4500: usd*4500, copPerCreditAt4500: usd*4500/units };
}
function report() {
  const cases = [
    scenario('Texto breve supuesto',{ operation: 'reply',inputBytes: 2256,inputTokens: 800,outputTokens: 200 }),
    scenario('Texto intermedio supuesto',{ operation: 'reply',inputBytes: 12256,inputTokens: 4000,outputTokens: 400 }),
    scenario('Contexto largo supuesto',{ operation: 'analyze',inputBytes: 96256,inputTokens: 24000,outputTokens: 1024 }),
    scenario('Audio 60 segundos',{ operation: 'transcription',inputBytes: 64000,durationSeconds: 60 }),
    scenario('Audio 61 segundos',{ operation: 'transcription',inputBytes: 65000,durationSeconds: 61 }),
    scenario('Audio 10 minutos',{ operation: 'transcription',inputBytes: 640000,durationSeconds: 600 }),
    scenario('Embedding máximo conservador',{ operation: 'embedding',inputBytes: 8000,inputTokens: 8000 }),
  ];
  // Conservative envelope for text-only calls: at most one input token per UTF-8 byte,
  // including the framing allowance, with the full output cap on every call.
  const maxUsdPerCredit = costUsd({ operation: 'reply',inputTokens: TEXT_BLOCK_BYTES,outputTokens: MAX_COMPLETION_TOKENS });
  const plans = [{ name: 'Prueba',credits: 100,referenceCop: null },{ name: 'Básico',credits: 1000,referenceCop: 49000 },{ name: 'Pro',credits: 3000,referenceCop: 89000 }]
    .map(p => ({ ...p, providerCopAt4500: p.credits*maxUsdPerCredit*4500, providerCopAt6000: p.credits*maxUsdPerCredit*6000 }));
  return { checkedOn: '2026-10-29', rates, exchangeRatesAreBudgetAssumptions: true, excludes: ['taxes','infrastructure','support','paymentFees'], maxUsdPerCredit, cases, plans };
}
module.exports = { rates,costUsd,scenario,report };
