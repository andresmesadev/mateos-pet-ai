const { resolveContractRate } = require('../../domain/rules/contract-commission.rules');
const { calculateCommissionSplit } = require('../../domain/rules/commission-calculation.rules');
const { InvalidCommissionInputError, CommissionDayClosedError, CommissionInActiveSettlementError } = require('../../domain/errors');
const { civilDateKey } = require('../../../shared/business-day');
const { compatibleRole, canProvideService } = require('../../domain/rules/service-scope.rules');

function createRecordSaleServiceCommissionUseCase({ sourceReader, staffRepository, serviceCategoryReader, businessConfigReader, commissionRepository, dailyCloseReader, settlementCoverageReader, businessDayGate, staffFinanceGate }) {
  return async function execute({ tenantId, transactionItemId, serviceId, staffId, historicalReason, activeModules }, ctx) {
    if (!ctx?.tx || !ctx.eventPublisher || !tenantId) throw new Error('Sale commission requires tenant and transaction');
    const item = await sourceReader.lockItem(tenantId, transactionItemId, ctx);
    if (!item || item.itemKind !== 'service' || item.appointmentComponent || item.transaction.status !== 'active' || !item.transaction.paidAt) throw new InvalidCommissionInputError('Solo un servicio adicional pagado puede generar esta comisión.');
    const historical = historicalReason !== undefined;
    if (historical && (typeof historicalReason !== 'string' || !historicalReason.trim())) throw new InvalidCommissionInputError('La vinculación histórica necesita un motivo.');
    if (!historical && (serviceId !== item.serviceId || staffId !== item.performedByStaffId)) throw new InvalidCommissionInputError('La comisión debe corresponder al servicio y profesional del cobro.');
    const sourceService = await sourceReader.service(tenantId, serviceId, ctx);
    if (!sourceService || (!historical && !sourceService.active)) throw new InvalidCommissionInputError('Servicio ajeno, retirado o no encontrado.');
    const category = await serviceCategoryReader.getCategoryForService(serviceId, tenantId, ctx);
    if (!category) throw new InvalidCommissionInputError('Servicio ajeno o no encontrado.');
    if (activeModules && ['grooming', 'veterinary'].includes(category.name) && !activeModules.includes(category.name)) throw new InvalidCommissionInputError('El área de este servicio no está habilitada.');
    if (!category.appliesCommissionSplit && !staffId) return null;
    if (!staffId) throw new InvalidCommissionInputError('Selecciona el profesional que realizó el servicio.');
    const person = await staffRepository.findById(staffId, ctx);
    if (!person || person.tenantId !== tenantId || !person.active) throw new InvalidCommissionInputError('Selecciona el profesional activo que realizó el servicio.');
    const capabilities = await sourceReader.capabilities(staffId, serviceId, ctx);
    if (!compatibleRole(person, category.name) || !canProvideService(person, capabilities, serviceId)) throw new InvalidCommissionInputError('El profesional no tiene habilitado este servicio y área.');
    if (!category.appliesCommissionSplit) return null;
    const splitRate = await resolveContractRate(person, category, () => businessConfigReader.getCommissionSplitRate(tenantId, category.id));
    await staffFinanceGate.acquire(tenantId, staffId, ctx);
    const completedAt = item.transaction.paidAt;
    await businessDayGate.acquire(tenantId, civilDateKey(completedAt), ctx);
    if (await dailyCloseReader.findByCivilDay(tenantId, completedAt, ctx)) throw new CommissionDayClosedError(civilDateKey(completedAt));
    const covering = await settlementCoverageReader.findActiveCovering(staffId, completedAt, ctx);
    if (covering) throw new CommissionInActiveSettlementError(transactionItemId, covering.id);
    const existing = await commissionRepository.findByItem(tenantId, transactionItemId, ctx);
    if (existing) {
      if (existing.serviceId !== serviceId || existing.staffId !== staffId) throw new InvalidCommissionInputError('La línea ya tiene una comisión atribuida. Usa anulación y reemplazo para corregirla.');
      return existing;
    }
    const resolvedPrice = Number(item.total);
    if (!Number.isFinite(resolvedPrice) || resolvedPrice < 0) throw new InvalidCommissionInputError('Importe de línea inválido.');
    const result = await commissionRepository.create({ tenantId, appointmentId: null, transactionItemId, serviceId, staffId, resolvedPrice, priceSource: historical ? 'historical_sale_link' : 'sale_service_line', splitRate, ...calculateCommissionSplit(resolvedPrice, splitRate), serviceCategory: category.name, completedAt }, ctx);
    await ctx.eventPublisher.publish('ComisiónRegistrada', { commission: result, ...(historical ? { reason: historicalReason.trim() } : {}) });
    return result;
  };
}
module.exports = { createRecordSaleServiceCommissionUseCase };
