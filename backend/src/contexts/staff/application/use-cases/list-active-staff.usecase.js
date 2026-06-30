/**
 * ListActiveStaffUseCase — Consulta.
 * Implementa "Consultar Staff Activo". Vista administrativa del roster y
 * sus capacidades — no resuelve disponibilidad puntual (eso es
 * ResolveStaffAvailabilityUseCase). El resultado adjunta las capacidades
 * vigentes de cada miembro, tal como el contrato funcional lo promete
 * (corrección de fidelidad, Validación Funcional, Etapa 6).
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/staff-capability-repository.port").StaffCapabilityRepositoryPort} deps.staffCapabilityRepository
 */
function createListActiveStaffUseCase({ staffRepository, staffCapabilityRepository }) {
  return async function execute({ tenantId, role = null, serviceId = null, includeInactive = false }) {
    let staff = await staffRepository.listActive({ tenantId, role, includeInactive });

    if (serviceId) {
      const capableStaffIds = new Set(
        (await staffCapabilityRepository.listActiveByService(serviceId)).map((c) => c.staffId)
      );
      staff = staff.filter((s) => capableStaffIds.has(s.id));
    }

    const staffWithCapabilities = await Promise.all(
      staff.map(async (member) => ({
        ...member,
        capabilities: await staffCapabilityRepository.listActiveByStaff(member.id),
      }))
    );

    return { staff: staffWithCapabilities };
  };
}

module.exports = { createListActiveStaffUseCase };
