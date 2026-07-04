const { InvalidChannelAttributesError, DuplicateChannelError } = require("../../domain/errors");

/**
 * RegisterChannelUseCase — Administración. Caso de uso 1 (Etapa 2).
 * No implica migrar las credenciales reales del entorno (Decisión 2, diferida).
 */
function createRegisterChannelUseCase({ channelRepository, eventPublisher }) {
  return async function execute({ tenantId = null, type }) {
    if (!type || !type.trim()) {
      throw new InvalidChannelAttributesError("type es obligatorio.");
    }

    const existing = await channelRepository.findByTenantAndType(tenantId, type.trim());
    if (existing) {
      throw new DuplicateChannelError(type.trim(), tenantId);
    }

    const channel = await channelRepository.create({
      tenantId: tenantId ?? null,
      type: type.trim(),
      active: true,
    });

    await eventPublisher.publish("CanalRegistrado", { channel });

    return { channel };
  };
}

module.exports = { createRegisterChannelUseCase };
