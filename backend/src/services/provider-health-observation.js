// Volatile evidence from the existing probe, never an extra provider request.
let openai = null;
const MAX_AGE_MS = 10 * 60 * 1000;
function recordOpenAIProbe(ok, now = Date.now()) {
  openai = { ok: Boolean(ok), at: now };
}
function readOpenAIProbe(now = Date.now()) {
  if (!openai || now < openai.at || now - openai.at > MAX_AGE_MS) return null;
  return { ok: openai.ok, observedAt: new Date(openai.at).toISOString() };
}
module.exports = { recordOpenAIProbe, readOpenAIProbe };
