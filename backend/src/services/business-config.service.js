/**
 * Entregable 4.3 (Fase 4) — Configuración por Establecimiento (Alcance A).
 *
 * Fuente real de configuración de negocio, hoy limitada a los dos valores
 * ya consumidos por casos de uso existentes (Servicios, Staff) a través de
 * sus respectivos BusinessConfigReaderPort: módulos activos y tasa de split
 * de comisión. Reemplaza los dos PrismaBusinessConfigReader duplicados que
 * devolvían valores hardcodeados sin distinción de tenant.
 *
 * Sin relación con horarios de atención ni zona horaria (Alcance B) — ver
 * Reconciliación Arquitectónica del Entregable 4.3: esos dos requieren
 * tocar el motor conversacional protegido desde 3.4, y quedan diferidos.
 */
const prisma = require("../lib/prisma");

const DEFAULT_ACTIVE_MODULES = ["grooming", "veterinary"];
const DEFAULT_COMMISSION_SPLIT_RATE = 0.5;

const getActiveModules = async (tenantId) => {
  if (!tenantId) return DEFAULT_ACTIVE_MODULES;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { activeModules: true },
  });
  return tenant?.activeModules?.length ? tenant.activeModules : DEFAULT_ACTIVE_MODULES;
};

/**
 * @param {string} tenantId
 * @param {string} _categoryId — reservado para tasas por categoría (no
 *   evidenciado hoy: el propio stub que este servicio reemplaza ignoraba
 *   este parámetro; se conserva la firma del puerto sin usarlo).
 */
const getCommissionSplitRate = async (tenantId, _categoryId) => {
  if (!tenantId) return DEFAULT_COMMISSION_SPLIT_RATE;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { commissionSplitRate: true },
  });
  return tenant ? Number(tenant.commissionSplitRate) : DEFAULT_COMMISSION_SPLIT_RATE;
};

const updateActiveModules = async (tenantId, modules) => {
  if (!tenantId) throw new Error("tenantId is required");
  if (!Array.isArray(modules) || modules.some((m) => typeof m !== "string" || !m.trim())) {
    throw new Error("modules must be a non-empty array of strings");
  }
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { activeModules: modules },
    select: { id: true, activeModules: true },
  });
};

const updateCommissionSplitRate = async (tenantId, rate) => {
  if (!tenantId) throw new Error("tenantId is required");
  const numeric = Number(rate);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error("rate must be a number between 0 and 1");
  }
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { commissionSplitRate: numeric },
    select: { id: true, commissionSplitRate: true },
  });
};

module.exports = {
  DEFAULT_ACTIVE_MODULES,
  DEFAULT_COMMISSION_SPLIT_RATE,
  getActiveModules,
  getCommissionSplitRate,
  updateActiveModules,
  updateCommissionSplitRate,
};
