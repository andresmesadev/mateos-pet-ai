jest.mock('../../../lib/prisma', () => ({ eventDelivery: { create: jest.fn() } }));
const prisma = require('../../../lib/prisma');
const { createEvaluateAndExecuteRulesMechanism } = require('../application/use-cases/evaluate-and-execute-rules.mechanism');
const { EventsRegisterEventDeliveryAdapter } = require('../infrastructure/events/event-delivery.adapter');
const { createRegisterEventDeliveryMechanism } = require('../../events/application/use-cases/register-event-delivery.mechanism');
const { PrismaEventDeliveryRepository } = require('../../events/infrastructure/persistence/prisma-event-delivery.repository');

beforeEach(() => jest.clearAllMocks());
test.each([false, true])('delivery preserves the producer transaction through both adapters (failed=%s)', async failed => {
  const create = jest.fn(async ({ data }) => ({ id: 'delivery', ...data }));
  const ctx = { tx: { eventDelivery: { create } } };
  const eventPublisher = { publish: jest.fn() };
  const registerEventDelivery = createRegisterEventDeliveryMechanism({ eventDeliveryRepository: new PrismaEventDeliveryRepository(), eventPublisher });
  const execute = createEvaluateAndExecuteRulesMechanism({
    automationRuleRepository: { listActiveByTrigger: async () => { if (failed) throw new Error('synthetic read failure'); return []; } },
    automationExecutionRepository: {}, actionExecutor: {},
    eventDelivery: new EventsRegisterEventDeliveryAdapter({ registerEventDelivery }), logger: { error: jest.fn() },
  });
  await execute({ domainEvent: { id: 'uncommitted-event', tenantId: 'tenant', eventTypeId: 'type' }, eventPayload: {} }, ctx);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith({ data: {
    domainEventId: 'uncommitted-event', consumer: 'Automatizaciones',
    status: failed ? 'failed' : 'delivered', failureReason: failed ? 'synthetic read failure' : null,
  } });
  expect(prisma.eventDelivery.create).not.toHaveBeenCalled();
});

test('standalone delivery still uses the normal database client', async () => {
  prisma.eventDelivery.create.mockResolvedValueOnce({ id: 'standalone' });
  const data = { domainEventId: 'committed-event', consumer: 'Automatizaciones', status: 'delivered' };
  await expect(new PrismaEventDeliveryRepository().create(data)).resolves.toEqual({ id: 'standalone' });
  expect(prisma.eventDelivery.create).toHaveBeenCalledWith({ data });
});
