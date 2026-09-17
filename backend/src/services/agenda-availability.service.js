const { getBusinessHours } = require("./business-config.service");
const { getAgendaExceptionForDate } = require("./agenda-exception.service");
const availability = require("./availability.service");

async function getAvailabilityContext({ tenantId, dateKey, serviceType }) {
  const [businessHours, exception] = await Promise.all([
    getBusinessHours(tenantId),
    getAgendaExceptionForDate(tenantId, dateKey, serviceType),
  ]);
  return { businessHours, exception };
}

const resolveEffectiveHourWindow = ({ serviceType, dateKey, businessHours, exception }) =>
  availability.resolveHourWindow(serviceType, dateKey, businessHours, exception);

const isEffectiveBusinessDay = ({ dateKey, serviceType, businessHours, exception }) =>
  availability.isBusinessDay(dateKey, businessHours, serviceType, exception);

module.exports = { getAvailabilityContext, resolveEffectiveHourWindow, isEffectiveBusinessDay };
