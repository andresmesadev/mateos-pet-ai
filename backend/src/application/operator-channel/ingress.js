const p = require('./protocol');
// Parse before the legacy adapter turns native IDs into display titles.
// Never retain a linking code, raw native token, media, contacts or webhook body.
function parseOperatorInputs(body, settings) {
  const inputs = [];
  for (const entry of body?.entry || []) for (const change of entry.changes || []) {
    const value = change?.value; const receiver = value?.metadata?.phone_number_id;
    for (const m of value?.messages || []) {
      if (typeof m.id !== 'string' || m.id.length > 512 || typeof receiver !== 'string' || !/^[0-9]{1,64}$/.test(receiver) || !/^[1-9][0-9]{6,14}$/.test(m.from || '')) continue;
      const base = { v: 2, receiver, from: m.from, id: m.id, timestamp: String(m.timestamp || '').slice(0,20) };
      const text = m.type === 'text' ? m.text?.body : null;
      if (typeof text === 'string' && /\/vincular\b/i.test(text)) {
        const match = /^\/vincular\s+([A-F0-9]{10})\s*$/i.exec(text.trim());
        inputs.push({ ...base, kind: 'link', codeDigest: match && settings.key ? p.mac(settings.key, 'link-code', { receiver, phone: m.from, code: match[1].toUpperCase() }) : null, reserved: true }); continue;
      }
      const native = m.type === 'interactive' ? m.interactive?.button_reply?.id || m.interactive?.list_reply?.id : null;
      if (typeof native === 'string' && native.startsWith('op1.')) {
        inputs.push({ ...base, kind: 'interaction', tokenDigest: settings.key ? p.mac(settings.key, 'interaction-token', native) : null,
          contextId: typeof m.context?.id === 'string' ? m.context.id.slice(0,512) : null,
          forwarded: !!(m.context?.forwarded || m.context?.frequently_forwarded), reserved: true }); continue;
      }
      if (typeof text === 'string') {
        const command = /^\/(negocio|clientes)\s*$/i.exec(text.trim());
        inputs.push({ ...base, kind: command ? command[1].toLowerCase() : 'text', ...(command ? { reserved: true } : { text: [...text].slice(0,4000).join('') }) });
      } else inputs.push({ ...base, kind: 'unsupported' });
    }
  }
  return inputs;
}
function customerPayload(input) {
  if (input.kind !== 'text') return null;
  return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: input.receiver },
    messages: [{ id: input.id, from: input.from, timestamp: input.timestamp, type: 'text', text: { body: input.text } }] } }] }] };
}
module.exports = { parseOperatorInputs, customerPayload };
