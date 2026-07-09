/**
 * Entregable 4.2 (Fase 4) — Onboarding Autónomo: aprovisionamiento por
 * defecto de un tenant recién registrado, para que quede operativo sin
 * intervención manual del equipo de desarrollo.
 *
 * Reutiliza el caso de uso ya expuesto por Empleados Digitales
 * (agents.registerDigitalEmployee) — mismo patrón que scripts/seed-digital-
 * employees.js, del que esta lógica se extrae para no duplicarla entre el
 * script manual y el flujo automático de registro.
 */
const agents = require("../contexts/agents");

const DEFAULT_SPECIALIZATIONS = ["recepcionista", "coordinador_agenda"];

async function ensureDigitalEmployeeForTenant(tenantId, specialization) {
  const { digitalEmployees } = await agents.getDigitalEmployees({ tenantId });
  const existing = digitalEmployees.find((e) => e.specialization === specialization);
  if (existing) {
    return { specialization, created: false, digitalEmployeeId: existing.id };
  }
  const { digitalEmployee } = await agents.registerDigitalEmployee({ tenantId, specialization });
  return { specialization, created: true, digitalEmployeeId: digitalEmployee.id };
}

/**
 * Siembra los Empleados Digitales por defecto para un tenant. Idempotente
 * (no duplica si ya existen). Cada especialización se aprovisiona de forma
 * aislada: el fallo de una no impide aprovisionar las demás, mismo
 * principio de aislamiento de fallos institucionalizado en 3.3/3.4/3.5.
 *
 * @param {string} tenantId
 * @returns {Promise<{ results: Array<{specialization: string, created: boolean, digitalEmployeeId?: string, error?: string}> }>}
 */
async function provisionDefaultDigitalEmployees(tenantId) {
  const results = [];
  for (const specialization of DEFAULT_SPECIALIZATIONS) {
    try {
      results.push(await ensureDigitalEmployeeForTenant(tenantId, specialization));
    } catch (error) {
      results.push({ specialization, created: false, error: error.message });
    }
  }
  return { results };
}

module.exports = {
  DEFAULT_SPECIALIZATIONS,
  ensureDigitalEmployeeForTenant,
  provisionDefaultDigitalEmployees,
};
