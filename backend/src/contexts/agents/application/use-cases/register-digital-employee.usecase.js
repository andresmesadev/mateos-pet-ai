const { InvalidDigitalEmployeeAttributesError } = require("../../domain/errors");
const { SPECIALIZATIONS } = require("../ports/digital-employee-repository.port");

function createRegisterDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher }) {
  return async function execute({ tenantId = null, specialization }) {
    if (!SPECIALIZATIONS.includes(specialization)) {
      throw new InvalidDigitalEmployeeAttributesError(
        `specialization debe ser uno de: ${SPECIALIZATIONS.join(", ")}`
      );
    }
    const digitalEmployee = await digitalEmployeeRepository.create({
      tenantId: tenantId ?? null,
      specialization,
      status: "activo",
    });
    await eventPublisher.publish("EmpleadoDigitalRegistrado", { digitalEmployee });
    return { digitalEmployee };
  };
}
module.exports = { createRegisterDigitalEmployeeUseCase };
