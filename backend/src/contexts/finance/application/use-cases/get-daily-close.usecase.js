const { DailyCloseNotFoundError } = require("../../domain/errors");

function dayStart(date) {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * GetDailyCloseUseCase — Consulta.
 * Lectura pura de un hecho ya congelado — no recalcula nada.
 */
function createGetDailyCloseUseCase({ dailyCloseRepository }) {
  return async function execute({ tenantId, date }) {
    const dailyClose = await dailyCloseRepository.findByDate(tenantId ?? null, dayStart(date));
    if (!dailyClose) {
      throw new DailyCloseNotFoundError(date);
    }
    return { dailyClose };
  };
}

module.exports = { createGetDailyCloseUseCase };
