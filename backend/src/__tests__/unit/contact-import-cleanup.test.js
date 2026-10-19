const { cleanupImportedContact, mergePhones } = require('../../services/contact-import-cleanup.service');

test('recovers all source numbers without duplicating the primary and separates dates/metadata from observations', () => {
  const result = cleanupImportedContact({ phone: '573001234567', phoneAlt: '6042345678', notes: 'Registro original: R001603 | Detalle original de tarifa: Last Name: 55.000 | Teléfonos móviles originales: 3001234567-3111234567 | Teléfono de casa original: 2345678 | Otros teléfonos normalizados: 3121234567 / 3131234567 | Notas originales: 01/01/26=01/02/26 | Fechas de peluquería del contacto: 2026-01-01 | 2026-02-01 | Última visita del contacto: 01/02/2026' });
  expect(result).toEqual({ recognized: true, phoneAlt: '6042345678 / 573111234567 / 573121234567 / 573131234567', notes: null });
});
test('ordinary notes, including dates, are never treated as import metadata', () => {
  const notes = 'Llamar el 01/02/2026. Registro original es una nota del usuario.';
  expect(cleanupImportedContact({ phone: '3001234567', notes })).toMatchObject({ recognized: false, notes });
});
test('retains actual observations from the source notes and supplementary information', () => {
  const result = cleanupImportedContact({ notes: 'Registro original: R001 | Notas originales: 01/01/26= Avisar antes de recoger. | Datos adicionales: Contactar a la hija | Fechas de peluquería del contacto: 2026-01-01 | Última visita del contacto: 01/01/26' });
  expect(result.notes).toBe('Avisar antes de recoger.\nContactar a la hija');
});
test('merging remains idempotent and normalizes formatted landlines and mobiles individually', () => {
  const extra = mergePhones('3001234567', '(604) 234 5678 / +57 311 123 4567', '2345678;3111234567');
  expect(extra).toBe('6042345678 / 573111234567');
  expect(mergePhones('573001234567', extra, extra)).toBe(extra);
});
