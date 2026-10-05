const { bogotaDayStart, followupDates, parseContactDay } = require('../services/dashboard-followup-dates');
test('today boundaries follow Bogotá even when UTC has moved to tomorrow', () => {
  const now = new Date('2026-10-06T02:00:00Z');
  expect(bogotaDayStart(now)).toEqual(new Date('2026-10-05T05:00:00Z'));
  expect(followupDates('past', now)).toEqual({ lt: new Date('2026-10-05T05:00:00Z') });
  expect(followupDates('today', now)).toEqual({ gte: new Date('2026-10-05T05:00:00Z'), lt: new Date('2026-10-06T05:00:00Z') });
  expect(followupDates('next7', now)).toEqual({ gte: new Date('2026-10-06T05:00:00Z'), lt: new Date('2026-10-13T05:00:00Z') });
});
test('contact dates parse valid leap days and reject calendar overflow', () => {
  expect(parseContactDay('2024-02-29')).toEqual(new Date('2024-02-29T05:00:00Z'));
  expect(() => parseContactDay('2026-02-29')).toThrow('La fecha de contacto no es válida.');
  expect(parseContactDay('')).toBeNull();
});
