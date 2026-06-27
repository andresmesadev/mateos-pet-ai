/**
 * Domain Service — Price Resolution
 *
 * Single authority for resolving the effective price of any service
 * within the Plataforma Operativa Inteligente.
 *
 * Implements the three-level hierarchy (Decisión B, Fase 1):
 *   1. Manual override  — Appointment.finalPrice (explicitly set by operator)
 *   2. Pet default      — Pet.defaultGroomingPrice (agreed price for this animal)
 *   3. Service base     — Service.basePrice (catalog default)
 *
 * Contract: NO module may access finalPrice, defaultGroomingPrice, or basePrice
 * directly for price decisions. All callers must go through resolvePrice() or
 * resolveAppointmentPrice().
 *
 * The resolution result includes full traceability so audit, debug, reporting
 * and AI agents can always explain how a price was reached.
 */

/** @readonly */
const PRICE_SOURCES = Object.freeze({
  MANUAL_OVERRIDE:   "manual_override",
  PET_DEFAULT_PRICE: "pet_default_price",
  SERVICE_BASE_PRICE:"service_base_price",
  UNRESOLVED:        "unresolved",
});

/**
 * @typedef {"manual_override"|"pet_default_price"|"service_base_price"|"unresolved"} PriceSource
 *
 * @typedef {Object} PriceResolution
 * @property {number|null} finalPrice       - Effective price to use; null = no price configured
 * @property {PriceSource} source           - Which level of the hierarchy supplied the price
 * @property {number|null} manualOverride   - Raw Appointment.finalPrice (null if not set)
 * @property {number|null} petDefaultPrice  - Raw Pet.defaultGroomingPrice (null if not set)
 * @property {number|null} serviceBasePrice - Raw Service.basePrice (null if not set)
 */

/**
 * Resolves the effective price for a service appointment.
 *
 * @param {Object} inputs
 * @param {number|null} [inputs.manualOverride]   - Appointment.finalPrice
 * @param {number|null} [inputs.petDefaultPrice]  - Pet.defaultGroomingPrice
 * @param {number|null} [inputs.serviceBasePrice] - Service.basePrice
 * @returns {PriceResolution}
 */
function resolvePrice({ manualOverride = null, petDefaultPrice = null, serviceBasePrice = null } = {}) {
  const mo = manualOverride   != null ? Number(manualOverride)   : null;
  const pd = petDefaultPrice  != null ? Number(petDefaultPrice)  : null;
  const sb = serviceBasePrice != null ? Number(serviceBasePrice) : null;

  const trace = { manualOverride: mo, petDefaultPrice: pd, serviceBasePrice: sb };

  if (mo !== null && !isNaN(mo)) {
    return { ...trace, finalPrice: mo, source: PRICE_SOURCES.MANUAL_OVERRIDE };
  }
  if (pd !== null && !isNaN(pd)) {
    return { ...trace, finalPrice: pd, source: PRICE_SOURCES.PET_DEFAULT_PRICE };
  }
  if (sb !== null && !isNaN(sb)) {
    return { ...trace, finalPrice: sb, source: PRICE_SOURCES.SERVICE_BASE_PRICE };
  }
  return { ...trace, finalPrice: null, source: PRICE_SOURCES.UNRESOLVED };
}

/**
 * Convenience wrapper: resolves price directly from a Prisma appointment row.
 *
 * Requires the appointment to have been fetched with:
 *   pet: { select: { defaultGroomingPrice: true } }
 *   service: { select: { basePrice: true } }
 *
 * @param {Object} appointment - Prisma appointment row with pet and service included
 * @returns {PriceResolution}
 */
function resolveAppointmentPrice(appointment) {
  return resolvePrice({
    manualOverride:   appointment.finalPrice               != null ? Number(appointment.finalPrice)               : null,
    petDefaultPrice:  appointment.pet?.defaultGroomingPrice != null ? Number(appointment.pet.defaultGroomingPrice) : null,
    serviceBasePrice: appointment.service?.basePrice        != null ? Number(appointment.service.basePrice)        : null,
  });
}

module.exports = { resolvePrice, resolveAppointmentPrice, PRICE_SOURCES };
