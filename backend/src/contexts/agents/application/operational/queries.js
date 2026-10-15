const { dateOnly, fail, intentInput, limitedResult } = require('./policy');
function buildOperationalQueries({ finance, inventory }) {
  return async function read(intent, fields, input, ctx) {
    intentInput(intent, fields);
    let result;
    const tenantId = input.tenantId;
    if (intent === 'financial_history') {
      const start = dateOnly(fields.rangeStart, 'Desde'), end = dateOnly(fields.rangeEnd, 'Hasta');
      const span = (Date.parse(end) - Date.parse(start)) / 86400000;
      if (span < 0 || span > 30) fail('INVALID_RANGE', 'Consulta hasta 31 días civiles por solicitud.', 400);
      result = await finance.getFinancialHistory({ tenantId, rangeStart: start, rangeEnd: end }, ctx);
    } else if (intent === 'daily_close') {
      const date = dateOnly(fields.date, 'Fecha');
      try { result = await finance.getDailyClose({ tenantId, date }, ctx); }
      catch (e) { if (e.name !== 'DailyCloseNotFoundError') throw e; result = { generated: false, date, message: 'Cierre no generado. Esta consulta no crea un cierre.' }; }
    }
    else if (intent === 'financial_period') {
      const periodStart = dateOnly(fields.periodStart, 'Inicio'), periodEnd = dateOnly(fields.periodEnd, 'Fin');
      if (periodEnd < periodStart) fail('INVALID_RANGE', 'El fin del período debe ser posterior al inicio.', 400);
      try { result = await finance.getFinancialPeriod({ tenantId, periodStart, periodEnd }, ctx); }
      catch (e) { if (e.name !== 'FinancialPeriodNotFoundError') throw e; result = { generated: false, periodStart, periodEnd, message: 'Período no generado. Esta consulta no crea un período.' }; }
    }
    else if (intent === 'inventory_search') {
      if (fields.status && !['low','expired','expiring'].includes(fields.status)) fail('INVALID_INPUT', 'Filtro de inventario no válido.', 400);
      result = await inventory.reads.list({ ...input, query: fields }, ctx);
    } else if (intent === 'inventory_detail') result = await inventory.reads.detail({ ...input, id: fields.productId }, ctx);
    else if (intent === 'inventory_movements') result = await inventory.reads.movements({ ...input, id: fields.productId, cursor: fields.cursor }, ctx);
    else fail('INVALID_INTENT', 'Consulta no disponible.', 400);
    return limitedResult(result);
  };
}
module.exports = { buildOperationalQueries };
