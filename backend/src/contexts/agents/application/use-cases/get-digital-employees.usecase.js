function createGetDigitalEmployeesUseCase({ digitalEmployeeRepository }) {
  return async function execute({ tenantId = null } = {}) {
    const digitalEmployees = await digitalEmployeeRepository.list(tenantId);
    return { digitalEmployees };
  };
}
module.exports = { createGetDigitalEmployeesUseCase };
