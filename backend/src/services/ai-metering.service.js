// ADR 034: quantities are server measurements, never customer-supplied credit amounts.
const TEXT_BLOCK_BYTES = 4000;
const MAX_TEXT_BYTES = 128000;
const MAX_EMBEDDING_BYTES = 8000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 600;
const MAX_COMPLETION_TOKENS = 1024;
const METER_REVISION = 'm2';
const invalid = (code, status = 413) => Object.assign(new Error(code), { code, status });

function meterOperation(operation, { inputBytes = 0, durationSeconds } = {}, weight) {
  const maxBytes = operation === 'transcription' ? MAX_AUDIO_BYTES : operation === 'embedding' ? MAX_EMBEDDING_BYTES : MAX_TEXT_BYTES;
  if (!Number.isSafeInteger(inputBytes) || inputBytes < 0 || inputBytes > maxBytes) throw invalid('AI_INPUT_TOO_LARGE');
  if (!Number.isSafeInteger(weight) || weight <= 0) throw invalid('INVALID_AI_OPERATION', 400);
  let quantity = 1, basis = 'call', durationMilliseconds;
  if (operation === 'transcription') {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw invalid('AI_AUDIO_DURATION_REQUIRED', 422);
    if (durationSeconds > MAX_AUDIO_SECONDS) throw invalid('AI_AUDIO_TOO_LONG');
    durationMilliseconds = Math.ceil(durationSeconds * 1000);
    quantity = Math.ceil(durationMilliseconds / 60000);
    basis = 'started_minutes';
  } else if (operation !== 'embedding') {
    quantity = Math.max(1, Math.ceil(inputBytes / TEXT_BLOCK_BYTES));
    basis = 'input_blocks';
  }
  const units = weight * quantity;
  if (!Number.isSafeInteger(units) || units <= 0) throw invalid('INVALID_AI_OPERATION', 400);
  return { units, meter: { revision: METER_REVISION, basis, inputBytes, quantity, weight,
    ...(durationMilliseconds === undefined ? {} : { durationMilliseconds }) } };
}

function transcriptionDurationConfirmed(response, durationSeconds) {
  return Number.isFinite(response?.duration) && response.duration > 0 &&
    response.duration <= MAX_AUDIO_SECONDS + 1 && Math.abs(response.duration - durationSeconds) <= 1;
}

module.exports = { meterOperation, transcriptionDurationConfirmed, TEXT_BLOCK_BYTES, MAX_TEXT_BYTES,
  MAX_EMBEDDING_BYTES, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, MAX_COMPLETION_TOKENS, METER_REVISION };
