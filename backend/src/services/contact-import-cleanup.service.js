const LABELS = ['Registro original', 'Especie indicada en origen', 'Detalle original de tarifa', 'Tarifa registrada en origen \\(COP\\)', 'Teléfonos móviles originales', 'Teléfono de casa original', 'Teléfono de trabajo original', 'Correo', 'Otras direcciones', 'Datos adicionales', 'Notas originales', 'Fechas de peluquería del contacto', 'Última visita del contacto', 'Otros teléfonos normalizados'];
const marker = () => new RegExp('(?:^| \\| )(' + LABELS.join('|') + '):\\s*', 'g');

function phoneList(value) {
  const result = [];
  for (const part of String(value ?? '').split(/\s*[\/;,|\n]\s*|\s+-\s*|(?<=\d)-(?=\d{7,})/)) {
    const digits = part.replace(/[+()\s.-]/g, '');
    if (!/^\d{7,15}$/.test(digits)) continue;
    let number = digits;
    if (/^3\d{9}$/.test(number)) number = '57' + number;
    else if (/^57604\d{7}$/.test(number)) number = number.slice(2);
    else if (/^[2-8]\d{6}$/.test(number)) number = '604' + number;
    if (!result.includes(number)) result.push(number);
  }
  return result;
}

function mergePhones(primary, ...values) {
  const excluded = new Set(phoneList(primary));
  return [...new Set(values.flatMap(phoneList))].filter(value => !excluded.has(value)).join(' / ') || null;
}

function cleanupImportedContact({ phone, phoneAlt, phones_alt, notes }) {
  const raw = typeof notes === 'string' ? notes : '';
  const recognized = /^Registro original:\s*R\d+\b/.test(raw);
  if (!recognized) return { phoneAlt: mergePhones(phone, phoneAlt, phones_alt), notes: notes ?? null, recognized: false };
  const matches = [...raw.matchAll(marker())];
  const fields = new Map(matches.map((match, index) => [match[1], raw.slice(match.index + match[0].length, matches[index + 1]?.index ?? raw.length).trim()]));
  const observed = [];
  for (const key of ['Notas originales', 'Datos adicionales', 'Otras direcciones']) {
    const value = fields.get(key);
    if (!value) continue;
    // Dates are already imported as pet history. Keep any accompanying prose.
    const text = value.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '').replace(/^[\s|=;,⏎-]+|[\s|=;,⏎-]+$/g, '').trim();
    if (text) observed.push(text);
  }
  const telephoneFields = ['Teléfonos móviles originales', 'Teléfono de casa original', 'Teléfono de trabajo original', 'Otros teléfonos normalizados'];
  return { recognized: true, phoneAlt: mergePhones(phone, phoneAlt, phones_alt, ...telephoneFields.map(key => fields.get(key))), notes: [...new Set(observed)].join('\n') || null };
}

module.exports = { phoneList, mergePhones, cleanupImportedContact };
