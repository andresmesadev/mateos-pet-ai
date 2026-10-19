jest.mock('../../lib/prisma', () => ({ pet: { update: jest.fn() } }));
const prisma = require('../../lib/prisma');
const { updatePet } = require('../../services/pet.service');
beforeEach(() => jest.clearAllMocks());
test('explicit null clears an existing pet note', async () => {
  await updatePet('pet-a', { notes: null });
  expect(prisma.pet.update.mock.calls[0][0].data.notes).toBeNull();
});
test('omitting notes preserves the stored note for older partial updates', async () => {
  await updatePet('pet-a', { breed: 'Criollo' });
  expect(prisma.pet.update.mock.calls[0][0].data.notes).toBeUndefined();
});
test('text notes preserve their content when saving the profile', async () => {
  await updatePet('pet-a', { notes: 'Cuidado registrado' });
  expect(prisma.pet.update.mock.calls[0][0].data.notes).toBe('Cuidado registrado');
});
