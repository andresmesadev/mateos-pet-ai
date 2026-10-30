const prisma = require('../lib/prisma');

async function getBusinessName(tenantId) {
  if (typeof tenantId !== 'string' || !tenantId.trim()) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { name: true },
  });
  return typeof tenant?.name === 'string' ? tenant.name.trim() || null : null;
}

module.exports = { getBusinessName };
