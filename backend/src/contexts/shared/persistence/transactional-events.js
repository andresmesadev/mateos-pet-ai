function createEventCollector() {
  const events = [];
  return { events, async publish(name, payload) { events.push({ name, payload }); } };
}
function isRetryableTransactionError(error) {
  const code = error?.meta?.code ?? error?.meta?.driverAdapterError?.cause?.originalCode ?? error?.cause?.code;
  return error?.code === 'P2034' || ['40001', '40P01'].includes(code);
}
/** An existing transaction owns commit and publication; never nest transactions. */
function transactionalCommand(command, { unitOfWork, eventPublisher }) {
  return async (input, ctx) => {
    if (ctx?.tx) {
      if (!ctx.eventPublisher) throw new Error('Transactional command requires a transaction-local event publisher');
      return command(input, ctx);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const collector = createEventCollector();
      let result;
      try {
        result = await unitOfWork.run(inner => command(input, { ...inner, eventPublisher: collector }),
          { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 });
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
      // Outside the retry block: an uncertain postcommit publication must never rerun the business command.
      for (const event of collector.events) await eventPublisher.publish(event.name, event.payload);
      return result;
    }
  };
}
module.exports = { createEventCollector, isRetryableTransactionError, transactionalCommand };
