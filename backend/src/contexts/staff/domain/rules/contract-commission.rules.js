const { InvalidStaffAttributesError } = require('../errors');

function validateContract(contractType, commissionRate) {
  if (!['fixed', 'service'].includes(contractType)) throw new InvalidStaffAttributesError('Selecciona Fijo o Prestación de servicios.');
  if (contractType === 'fixed') {
    if (commissionRate !== null) throw new InvalidStaffAttributesError('El contrato fijo no tiene porcentaje de comisión.');
    return { contractType, commissionRate: null };
  }
  if (typeof commissionRate !== 'number' || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1 || Math.abs(commissionRate * 10000 - Math.round(commissionRate * 10000)) > 0.000001) {
    throw new InvalidStaffAttributesError('Indica un porcentaje entre 0 y 100, con máximo dos decimales.');
  }
  return { contractType, commissionRate };
}

async function resolveContractRate(staff, category, readLegacyRate) {
  if (!category.appliesCommissionSplit || staff.contractType === 'fixed') return 0;
  if (staff.contractType === 'service') {
    if (staff.commissionRate == null) throw new InvalidStaffAttributesError('Configura el porcentaje del profesional antes de finalizar.');
    return validateContract('service', Number(staff.commissionRate)).commissionRate;
  }
  return readLegacyRate();
}

module.exports = { validateContract, resolveContractRate };
