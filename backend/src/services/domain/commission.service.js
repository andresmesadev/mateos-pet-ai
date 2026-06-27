// Domain service: commission recording.
// A commission is an immutable accounting fact generated when a grooming appointment completes.
// The price snapshot is taken at the moment of completion; subsequent catalog or pet-price
// changes never affect historical commissions.

const prisma = require("../../lib/prisma");
const { resolveAppointmentPrice, PRICE_SOURCES } = require("./price-resolver.service");

const GROOMING_SPLIT_RATE = 0.5; // 50% staff / 50% business — Fase 1 rule

/**
 * Calculates staff and business shares for a given resolved price.
 * Rounding: staff share is rounded to 2 decimal places; business share is the remainder.
 * This ensures staffShare + businessShare === resolvedPrice exactly.
 */
function calculateSplit(resolvedPrice, splitRate = GROOMING_SPLIT_RATE) {
  const raw = resolvedPrice * splitRate;
  const staffShare = Math.round(raw * 100) / 100;
  const businessShare = Math.round((resolvedPrice - staffShare) * 100) / 100;
  return { staffShare, businessShare, splitRate };
}

/**
 * Records a grooming commission for a completed appointment.
 * Idempotent: if the commission already exists for this appointment, the call is a no-op.
 *
 * @param {{ appointment: object, completedAt?: Date }} params
 *   appointment must include: id, tenantId, staffId, finalPrice, pet.defaultGroomingPrice,
 *   service.basePrice, serviceType (the shape returned by APPOINTMENT_INCLUDE + mapAppointmentRow)
 * @returns {Promise<object|null>} the Commission record, or null if price is unresolved
 */
async function recordGroomingCommission({ appointment, completedAt }) {
  const priceResolution = resolveAppointmentPrice(appointment);

  if (
    priceResolution.source === PRICE_SOURCES.UNRESOLVED ||
    priceResolution.finalPrice === null
  ) {
    console.warn(
      `[Commission] Appointment ${appointment.id} completed with no resolved price — commission not recorded`
    );
    return null;
  }

  const { staffShare, businessShare, splitRate } = calculateSplit(priceResolution.finalPrice);

  try {
    const commission = await prisma.commission.upsert({
      where: { appointmentId: appointment.id },
      create: {
        tenantId:        appointment.tenantId ?? null,
        appointmentId:   appointment.id,
        staffId:         appointment.staffId ?? null,
        resolvedPrice:   priceResolution.finalPrice,
        priceSource:     priceResolution.source,
        splitRate,
        staffShare,
        businessShare,
        serviceCategory: "grooming",
        completedAt:     completedAt ?? new Date(),
      },
      update: {},
    });
    return commission;
  } catch (error) {
    console.error("[Commission] recordGroomingCommission error:", error.message);
    return null;
  }
}

module.exports = { recordGroomingCommission, calculateSplit, GROOMING_SPLIT_RATE };
