const { ChannelNotFoundError, ChannelAlreadyInactiveError } = require("../../domain/errors");

/**
 * DeactivateChannelUseCase — Administración. Caso de uso 2 (Etapa 2).
 * No borra, desactiva — mismo patrón que EventType/ServiceCategory.
 */
function createDeactivateChannelUseCase({ channelRepository, eventPublisher }) {
  return async function execute({ channelId }) {
    const channel = await channelRepository.findById(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }
    if (!channel.active) {
      throw new ChannelAlreadyInactiveError(channelId);
    }

    const deactivated = await channelRepository.deactivate(channelId);

    await eventPublisher.publish("CanalDesactivado", { channel: deactivated });

    return { channel: deactivated };
  };
}

module.exports = { createDeactivateChannelUseCase };
