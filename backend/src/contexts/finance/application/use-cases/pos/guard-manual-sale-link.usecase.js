const { InvalidTransactionOperationError } = require("../../../domain/errors");

/**
 * Guard de vinculación de venta manual — ADR 007-D3(b).
 * Una Transaction manual vinculada a una cita representa venta ADICIONAL de la
 * visita, nunca el servicio. Solo puede crearse cuando la cita está completada
 * y su cobro de sistema existe: antes de ese estado, un ticket vinculado solo
 * podría significar "cobrar el servicio a mano" — operación que dejó de existir.
 *
 * El flujo de creación del ticket (items, totales, contrato del POS de Fase 1)
 * permanece en su adaptador; este caso de uso es la regla de dominio que ese
 * adaptador debe consultar antes de crear una venta vinculada.
 */
function createGuardManualSaleLinkUseCase({ transactionRepository, completedAppointmentsReader }) {
  return async function execute({ tenantId, appointmentId }) {
    if (!appointmentId) {
      return { allowed: true }; // venta de mostrador sin cita — sin restricciones nuevas
    }

    const appointment = await completedAppointmentsReader.findById(tenantId ?? null, appointmentId);
    if (!appointment) {
      throw new InvalidTransactionOperationError(`La cita "${appointmentId}" no existe.`);
    }
    if (appointment.status !== "completed") {
      throw new InvalidTransactionOperationError(
        "Una venta vinculada a una cita solo puede registrarse cuando la cita está completada " +
          "y su cobro de sistema existe (ADR 007). El servicio ya no se cobra por POS."
      );
    }

    const systemCharge = await transactionRepository.findActiveByAppointment(
      appointmentId,
      "system_appointment_completed"
    );
    // Entregable 6.4 (Fase 6) — mismo chequeo de propiedad de tenant ya
    // aplicado en los casos de uso hermanos de este mismo módulo
    // (settle-system-charge, void-manual-sale): un cobro de sistema de otro
    // establecimiento se trata igual que si no existiera, sin distinguirlo.
    if (!systemCharge || (tenantId && systemCharge.tenantId !== tenantId)) {
      throw new InvalidTransactionOperationError(
        `La cita "${appointmentId}" está completada pero no tiene cobro de sistema; ` +
          "no puede vinculársele una venta manual (ADR 007)."
      );
    }

    return { allowed: true, systemCharge };
  };
}

module.exports = { createGuardManualSaleLinkUseCase };
