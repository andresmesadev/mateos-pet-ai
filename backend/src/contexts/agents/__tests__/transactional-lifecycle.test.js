const { createStartAgentTaskUseCase } = require('../application/use-cases/start-agent-task.usecase');
const { createRegisterAgentDecisionUseCase } = require('../application/use-cases/register-agent-decision.usecase');
const { createCompleteAgentTaskUseCase } = require('../application/use-cases/complete-agent-task.usecase');
const { createGenerateEscalationUseCase } = require('../application/use-cases/generate-escalation.usecase');

test.each(['complete', 'escalate'])('el ciclo de auditoría %s usa el mismo ctx y nunca publica por el adaptador legacy', async terminal => {
  const employee = { id: 'employee', tenantId: 't', status: 'activo' };
  const task = { id: 'task', status: 'en_proceso', digitalEmployee: { tenantId: 't' } };
  const d = {
    digitalEmployeeRepository: { findById: jest.fn().mockResolvedValue(employee) },
    agentTaskRepository: { create: jest.fn().mockResolvedValue(task), findById: jest.fn().mockResolvedValue(task), complete: jest.fn().mockResolvedValue({ ...task, status: 'completada' }), escalate: jest.fn() },
    agentDecisionRepository: { create: jest.fn().mockResolvedValue({ id: 'decision' }) },
    escalationRepository: { create: jest.fn().mockResolvedValue({ id: 'escalation' }) },
    eventPublisher: { publish: jest.fn() },
  };
  const ctx = { tx: {}, eventPublisher: { publish: jest.fn() } };
  await createStartAgentTaskUseCase(d)({ digitalEmployeeId: 'employee', origin: 'dashboard' }, ctx);
  await createRegisterAgentDecisionUseCase(d)({ agentTaskId: task.id, input: { actionId: 'a' }, reasoning: 'Confirmado por operador', action: 'register_expense' }, ctx);
  expect(d.digitalEmployeeRepository.findById).toHaveBeenCalledWith('employee', ctx);
  expect(d.agentTaskRepository.create).toHaveBeenCalledWith(expect.any(Object), ctx);
  expect(d.agentDecisionRepository.create).toHaveBeenCalledWith(expect.any(Object), ctx);
  if (terminal === 'complete') {
    await createCompleteAgentTaskUseCase(d)({ agentTaskId: task.id, result: { receiptId: 'r' } }, ctx);
    expect(d.agentTaskRepository.complete).toHaveBeenCalledWith(task.id, { receiptId: 'r' }, ctx);
  } else {
    await createGenerateEscalationUseCase(d)({ agentTaskId: task.id, context: { reason: 'Intervención' } }, ctx);
    expect(d.agentTaskRepository.escalate).toHaveBeenCalledWith(task.id, ctx);
    expect(d.escalationRepository.create).toHaveBeenCalledWith(expect.any(Object), ctx);
  }
  expect(ctx.eventPublisher.publish).toHaveBeenCalledTimes(3);
  expect(d.eventPublisher.publish).not.toHaveBeenCalled();
});
