const { StaffNotFoundError, InvalidAvailabilityRangeError } = require('../../domain/errors');

// El adaptador debe ejecutar este comando completo en una transacción.
function createCorrectAbsenceUseCase({ staffRepository, availabilityRepository, eventPublisher }) {
  return async function execute({ staffId, tenantId, absenceId, action, changeReason, author, range }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff || staff.tenantId !== tenantId) throw new StaffNotFoundError(staffId);
    const current = await availabilityRepository.findById(absenceId);
    if (!current || current.staffId !== staffId || current.type === 'base_schedule') {
      const error = new Error('Ausencia no encontrada.'); error.code = 'ABSENCE_NOT_FOUND'; throw error;
    }
    if (current.voidedAt) { const error = new Error('Esta ausencia ya fue anulada o corregida. Actualiza el panel.'); error.code = 'ABSENCE_CONFLICT'; throw error; }
    if (!['correct', 'void'].includes(action) || typeof changeReason !== 'string' || !changeReason.trim() || changeReason.length > 1000) {
      throw new InvalidAvailabilityRangeError('Indica un motivo de hasta 1000 caracteres para corregir o anular.');
    }
    if (action === 'correct' && (!range?.startAt || !range?.endAt || !Number.isFinite(new Date(range.startAt).getTime()) || !Number.isFinite(new Date(range.endAt).getTime()) || new Date(range.startAt) >= new Date(range.endAt) || (range.reason != null && (typeof range.reason !== 'string' || range.reason.length > 1000)))) {
      throw new InvalidAvailabilityRangeError('Selecciona un inicio y fin válidos y un motivo de hasta 1000 caracteres.');
    }
    const changed = await availabilityRepository.voidCurrent(absenceId, { voidedAt: new Date(), voidReason: changeReason.trim(), voidedBy: String(author || 'Administrador').slice(0,254) });
    if (changed.count !== 1) { const error = new Error('La ausencia cambió durante el guardado. Actualiza el panel.'); error.code = 'ABSENCE_CONFLICT'; throw error; }
    const replacement = action === 'correct' ? await availabilityRepository.create({ staffId, type: current.type, startAt: new Date(range.startAt), endAt: new Date(range.endAt), reason: range.reason?.trim() || null, replacesId: current.id }) : null;
    await eventPublisher.publish('DisponibilidadActualizada', { staffId, tenantId, origin: 'administration', action, absenceId, changeReason: changeReason.trim(), author, replacement });
    return { replacement };
  };
}
module.exports = { createCorrectAbsenceUseCase };
