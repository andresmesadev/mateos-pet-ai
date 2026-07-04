/**
 * GetChannelsUseCase — Consulta. Caso de uso 6 (Etapa 2).
 */
function createGetChannelsUseCase({ channelRepository }) {
  return async function execute() {
    const channels = await channelRepository.listActive();
    return { channels };
  };
}

module.exports = { createGetChannelsUseCase };
