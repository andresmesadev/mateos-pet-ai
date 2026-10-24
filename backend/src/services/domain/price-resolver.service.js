/**
 * Domain Service — Price Resolution
 *
 * Single authority for resolving the effective price of any service
 * within the Plataforma Operativa Inteligente.
 *
 * Resolves the appointment price using the existing service/pet agreement:
 *   1. Manual override  — Appointment.finalPrice (explicitly set by operator)
 *   2. Pet/service rule — active PriceRule for this pet and service
 *   3. Pet default      — legacy Pet.defaultGroomingPrice
 *   4. Service base     — Service.basePrice (catalog default)
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
  PET_AGREED_PRICE: "pet_agreed_price",
  PET_DEFAULT_PRICE: "pet_default_price",
  SERVICE_BASE_PRICE:"service_base_price",
  UNRESOLVED:        "unresolved",
});

/**
 * @typedef {"manual_override"|"pet_agreed_price"|"pet_default_price"|"service_base_price"|"unresolved"} PriceSource
 *
 * @typedef {Object} PriceResolution
 * @property {number|null} finalPrice       - Effective price to use; null = no price configured
 * @property {PriceSource} source           - Which level of the hierarchy supplied the price
 * @property {number|null} manualOverride   - Raw Appointment.finalPrice (null if not set)
 * @property {number|null} petDefaultPrice  - Raw Pet.defaultGroomingPrice (null if not set)
 * @property {number|null} petAgreedPrice   - Active PriceRule for this service and pet
 * @property {number|null} serviceBasePrice - Raw Service.basePrice (null if not set)
 */

/**
 * Resolves the effective price for a service appointment.
 *
 * @param {Object} inputs
 * @param {number|null} [inputs.manualOverride]   - Appointment.finalPrice
 * @param {number|null} [inputs.petAgreedPrice]    - PriceRule for pet/service
 * @param {number|null} [inputs.petDefaultPrice]  - Pet.defaultGroomingPrice
 * @param {number|null} [inputs.serviceBasePrice] - Service.basePrice
 * @returns {PriceResolution}
 */
function resolvePrice({ manualOverride = null, petAgreedPrice = null, petDefaultPrice = null, serviceBasePrice = null } = {}) {
  const mo = manualOverride   != null ? Number(manualOverride)   : null;
  const pa = petAgreedPrice   != null ? Number(petAgreedPrice)   : null;
  const pd = petDefaultPrice  != null ? Number(petDefaultPrice)  : null;
  const sb = serviceBasePrice != null ? Number(serviceBasePrice) : null;

  const trace = { manualOverride: mo, petAgreedPrice: pa, petDefaultPrice: pd, serviceBasePrice: sb };

  if (mo !== null && !isNaN(mo)) {
    return { ...trace, finalPrice: mo, source: PRICE_SOURCES.MANUAL_OVERRIDE };
  }
  if (pa !== null && !isNaN(pa)) {
    return { ...trace, finalPrice: pa, source: PRICE_SOURCES.PET_AGREED_PRICE };
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
 *   service.priceRules: active pet PriceRule rows (when available)
 *
 * @param {Object} appointment - Prisma appointment row with pet and service included
 * @returns {PriceResolution}
 */
function resolveAppointmentPrice(appointment) {
  const grooming = isGroomingAppointment(appointment);
  // A completed, unvalued visit must not silently acquire a later catalogue tariff.
  if (appointment.status === 'completed' && appointment.finalPrice == null && !grooming) return resolvePrice();
  const agreedRule = appointment.status === "completed" && appointment.finalPrice == null
    ? null
    : appointment.service?.priceRules?.find((rule) => rule.targetId === appointment.petId);
  return resolvePrice({
    manualOverride:   appointment.finalPrice               != null ? Number(appointment.finalPrice)               : null,
    petAgreedPrice:  agreedRule?.price                     != null ? Number(agreedRule.price)                       : null,
    petDefaultPrice:  grooming && appointment.pet?.defaultGroomingPrice != null ? Number(appointment.pet.defaultGroomingPrice) : null,
    serviceBasePrice: appointment.service?.basePrice        != null ? Number(appointment.service.basePrice)        : null,
  });
}

function isGroomingAppointment(appointment) {
  const category = appointment.service?.category?.name ?? appointment.serviceCategory;
  if (category) return category === 'grooming';
  return /groom|baño|bath|corte|peluquer|spa|deslan|antipulgas|colorimetr/i.test(String(appointment.serviceType ?? ''));
}

function isDeferredAppointmentPrice(appointment) {
  return appointment.status === 'completed' && appointment.finalPrice == null && !isGroomingAppointment(appointment);
}

function resolveProductPrice({ productBasePrice = null } = {}) {
  const price = productBasePrice == null ? null : Number(productBasePrice);
  return Number.isFinite(price) && price > 0
    ? { finalPrice: price, source: "product_base_price" }
    : { finalPrice: null, source: PRICE_SOURCES.UNRESOLVED };
}
// The service amount remains the commission base. Only this resolver adds
// transport or derives its reference from an individual inclusive agreement.
function resolveAppointmentTotal(appointment, zone = null) {
  const service = resolveAppointmentPrice(appointment);
  const mode = appointment.transportMode ?? "none";
  let referencePrice = null, referenceSource = "unresolved";
  const inclusive = appointment.pet?.defaultGroomingWithTransportPrice;
  const fee = appointment.pet?.defaultGroomingTransportPrice;
  const personalBase = service.source !== PRICE_SOURCES.SERVICE_BASE_PRICE && service.finalPrice != null;
  const habitualMode = appointment.pet?.defaultGroomingTransportMode;
  if (fee != null && (mode === habitualMode || (mode === 'round_trip' && (!habitualMode || habitualMode === 'round_trip')))) {
    referencePrice = Number(fee);
    referenceSource = "pet_agreement";
  } else if (mode === "round_trip" && inclusive != null) {
    // A historical inclusive total alone cannot establish a commission base.
    if (personalBase && Number(inclusive) >= service.finalPrice) {
      referencePrice = Math.round((Number(inclusive) - service.finalPrice) * 100) / 100;
      referenceSource = "pet_agreement";
    }
  } else if (zone) {
    const field = { round_trip: "roundTripPrice", pickup: "pickupPrice", delivery: "deliveryPrice" }[mode];
    if (field && zone[field] != null) { referencePrice = Number(zone[field]); referenceSource = "zone"; }
  }
  let transportPrice = appointment.transportPrice == null ? null : Number(appointment.transportPrice);
  let transportSource = appointment.transportPriceSource ?? "manual";
  if (mode === "none") { transportPrice = 0; transportSource = "none"; }
  if (mode === "shared") {
    const parent = appointment.transportSharedWith;
    const valid = parent && parent.tenantId === appointment.tenantId && parent.userId === appointment.userId &&
      !["none", "shared"].includes(parent.transportMode) && !["cancelled", "no_show"].includes(parent.status) && parent.transportPrice != null;
    transportPrice = valid ? 0 : null;
    transportSource = "shared";
  }
  if (!Number.isFinite(transportPrice) || transportPrice < 0) transportPrice = null;
  const needsBreakdown = mode === 'round_trip' && fee == null && inclusive != null && !personalBase;
  const servicePrice = needsBreakdown ? null : service.finalPrice;
  const total = amount => servicePrice == null || amount == null ? null : Math.round((servicePrice + amount) * 100) / 100;
  return { ...service, ...(needsBreakdown ? { finalPrice: null, source: PRICE_SOURCES.UNRESOLVED } : {}), servicePrice, transportPrice, totalPrice: total(transportPrice),
    transportPending: transportPrice == null, transportSource,
    transportReferencePrice: referencePrice, transportReferenceSource: referenceSource,
    quotedTotalPrice: total(referencePrice),
    agreedWithTransportTotal: inclusive == null ? null : Number(inclusive),
  };
}

module.exports = { resolvePrice, resolveAppointmentPrice, resolveAppointmentTotal, resolveProductPrice, PRICE_SOURCES, isGroomingAppointment, isDeferredAppointmentPrice };
