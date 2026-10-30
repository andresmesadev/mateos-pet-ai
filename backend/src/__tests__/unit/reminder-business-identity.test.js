jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn() } }));
jest.mock('../../contexts/communication', () => ({ sendMessage: jest.fn() }));
const prisma = require('../../lib/prisma');
const { sendMessage } = require('../../contexts/communication');
const { sendReminder } = require('../../services/reminder.service');
const appointment = tenantId => ({ id: 'appointment', tenantId, userId: 'user', user: { phone: '0000000000' },
  date: new Date('2026-10-30T15:30:00Z'), petName: 'Mascota demo', serviceType: 'grooming', tenant: { name: 'Spoofed name' } });
beforeEach(() => { jest.resetAllMocks(); sendMessage.mockResolvedValue({ message: {} }); });

test('two establishments retain their own current name and appointment details', async () => {
  prisma.tenant.findUnique.mockImplementation(async ({ where }) => ({ name: where.id === 'tenant-a' ? 'Centro A' : 'Pet shop B' }));
  for (const id of ['tenant-a', 'tenant-b']) expect(await sendReminder(appointment(id))).toBe(true);
  const [a, b] = sendMessage.mock.calls.map(([input]) => input);
  expect(a).toMatchObject({ tenantId: 'tenant-a', purpose: 'reminder' });
  expect(a.content).toContain('cita en Centro A:');
  expect(b.content).toContain('cita en Pet shop B:');
  expect(a.content).not.toContain('Pet shop B');
  for (const message of [a.content, b.content]) {
    expect(message).toContain('10:30 AM'); expect(message).toContain('Mascota demo');
    expect(message).not.toMatch(/Mateos Pet|Huella Nex|Spoofed name/);
  }
  expect(prisma.tenant.findUnique.mock.calls.map(([query]) => query.where)).toEqual([{ id: 'tenant-a' }, { id: 'tenant-b' }]);
});

test.each([null, { name: '' }, { name: '   ' }])('missing name %p produces a neutral reminder', async tenant => {
  prisma.tenant.findUnique.mockResolvedValue(tenant);
  expect(await sendReminder(appointment('tenant-a'))).toBe(true);
  expect(sendMessage.mock.calls[0][0].content).toContain('mañana tienes cita:');
  expect(sendMessage.mock.calls[0][0].content).not.toMatch(/undefined|null|Mateos Pet|Huella Nex/);
});

test('missing tenant or failed name lookup never falls back to a different tenant', async () => {
  expect(await sendReminder(appointment(null))).toBe(false);
  expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  prisma.tenant.findUnique.mockRejectedValue(new Error('database unavailable'));
  expect(await sendReminder(appointment('tenant-a'))).toBe(false);
  expect(sendMessage).not.toHaveBeenCalled();
});

test('paused or unconfirmed channel is not counted as delivered', async () => {
  prisma.tenant.findUnique.mockResolvedValue({ name: 'Centro A' });
  sendMessage.mockResolvedValue({ skipped: true, reason: 'whatsapp_disabled' });
  expect(await sendReminder(appointment('tenant-a'))).toBe(false);
});
