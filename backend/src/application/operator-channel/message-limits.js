// Channel limits apply to the full displayed preview, never to a truncated copy.
const TEXT_LIMIT = 4000;
const INTERACTIVE_LIMIT = 1024;
const length = value => typeof value === 'string' ? [...value].length : Infinity;
const fits = (text, interactive = false) => length(text) <= (interactive ? INTERACTIVE_LIMIT : TEXT_LIMIT);
const validButtons = buttons => Array.isArray(buttons) && buttons.length <= 3 && buttons.every(b =>
  typeof b.token === 'string' && length(b.token) > 0 && length(b.token) <= 256 &&
  typeof b.title === 'string' && length(b.title) > 0 && length(b.title) <= 20);
module.exports = { TEXT_LIMIT, INTERACTIVE_LIMIT, fits, validButtons };
