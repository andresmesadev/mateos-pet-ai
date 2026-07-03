const { resolveAppointmentPrice } = require("../../../../services/domain/price-resolver.service");
const { PriceResolutionPort } = require("../../application/ports/price-resolution.port");

/**
 * Adaptador sobre la fuente única de precio del proyecto (CLAUDE.md:
 * "el precio se resuelve en un único lugar" — price-resolver.service.js).
 */
class PriceResolverAdapter extends PriceResolutionPort {
  resolve(appointment) {
    return resolveAppointmentPrice(appointment);
  }
}

module.exports = { PriceResolverAdapter };
