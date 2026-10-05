const { fail, expiryKey, availableLot } = require('../../domain/policy');
const { civilDateKey } = require('../../../shared/business-day');
const { resolveProductPrice } = require('../../../../services/domain/price-resolver.service');
const { createHash } = require('node:crypto');
function buildInventoryReads({ unitOfWork, accessReader, clock = () => new Date() }) {
  const sum = lots => lots.reduce((n, l) => n + BigInt(l.balancePhysical), 0n).toString();
  const usesFor = access => {
    if (access.capabilities.inventory_manage) return null;
    const uses = [];
    if (access.capabilities.cash && access.capabilities.retail) uses.push('retail');
    if (access.capabilities.inventory_consume) uses.push(access.role === 'vet' ? 'veterinary' : 'grooming');
    return uses;
  };
  function dto(p, access, today) {
    const valid = p.lots.filter(l => availableLot(l, today));
    const upcoming = new Date(today + 'T00:00:00Z'); upcoming.setUTCDate(upcoming.getUTCDate() + 30);
    const through = upcoming.toISOString().slice(0, 10);
    const available = sum(valid), physical = sum(p.lots);
    const showPrice = access.capabilities.inventory_manage || (access.capabilities.cash && access.capabilities.retail);
    const resolution = resolveProductPrice({ productBasePrice: p.salePrice });
    return { id: p.id, name: p.name, category: p.category, internalCode: p.internalCode, barcode: p.barcode, presentation: p.presentation, uses: p.uses,
      active: p.active, lotPolicy: p.lotPolicy, stockMinimum: p.stockMinimum, metadataVersion: p.metadataVersion, priceVersion: p.priceVersion, stockRevision: p.stockRevision,
      available, physical, expired: (BigInt(physical) - BigInt(available)).toString(), lowStock: BigInt(available) <= BigInt(p.stockMinimum),
      ...(showPrice ? { salePrice: resolution.finalPrice, priceSource: resolution.source } : {}),
      ...(access.capabilities.inventory_manage ? { referenceCost: Number(p.referenceCost) } : {}),
      lots: p.lots.map(l => ({ id: l.id, lotCode: l.commercialCode, expiresOn: expiryKey(l), physical: l.balancePhysical,
        available: availableLot(l, today) ? l.balancePhysical : 0, expiresSoon: !!expiryKey(l) && expiryKey(l) > today && expiryKey(l) <= through })),
    };
  }
  async function list({ tenantId, actor, query = {} }) {
    return unitOfWork.run(async ctx => {
      const access = await accessReader.readAccess({ tenantId, actor }, ctx);
      if (!access.capabilities.inventory_read) fail('ACCESS_DENIED', 'No tienes acceso al inventario.', 403);
      const permitted = usesFor(access);
      if (query.use && (!['retail', 'veterinary', 'grooming'].includes(query.use) || (permitted && !permitted.includes(query.use)))) fail('ACCESS_DENIED', 'No tienes acceso al catálogo de esa área.', 403);
      const search = typeof query.search === 'string' ? query.search.trim().normalize('NFC').slice(0, 160) : '';
      const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 30)));
      const today = civilDateKey(clock()), expiresAt = new Date(today + 'T00:00:00Z');
      const cursorScope = createHash('sha256').update(JSON.stringify([tenantId, access.principalKey, permitted,
        search, query.use ?? null, query.category ?? null, query.status ?? null,
        access.capabilities.inventory_manage && query.includeInactive === '1', today])).digest('hex');
      let cursorId;
      if (query.cursor) {
        try {
          if (typeof query.cursor !== 'string' || query.cursor.length > 1000) throw new Error('Invalid cursor');
          const decoded = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
          if (decoded.version !== 1 || decoded.scope !== cursorScope || typeof decoded.id !== 'string' || decoded.id.length > 100) throw new Error('Invalid cursor');
          cursorId = decoded.id;
        } catch { fail('INVALID_CURSOR', 'Los filtros o la cuenta cambiaron. Actualiza el listado para continuar.', 400); }
        if (!await ctx.tx.inventoryProduct.findFirst({ where: { tenantId, id: cursorId }, select: { id: true } })) fail('INVALID_CURSOR', 'Actualiza el listado para continuar.', 400);
      }
      const soon = new Date(expiresAt); soon.setUTCDate(soon.getUTCDate() + 30);
      let lowIds;
      if (query.status === 'low') {
        const ids = await ctx.tx.$queryRaw`SELECT p.id FROM "InventoryProduct" p LEFT JOIN "InventoryLot" l
          ON l."productId"=p.id AND l."tenantId"=p."tenantId" AND (l."expiresOn" IS NULL OR l."expiresOn">${expiresAt})
          WHERE p."tenantId"=${tenantId} GROUP BY p.id HAVING COALESCE(SUM(l."balancePhysical"),0)<=p."stockMinimum"`;
        lowIds = ids.map(p => p.id);
      }
      const rows = await ctx.tx.inventoryProduct.findMany({ where: { tenantId,
        ...(access.capabilities.inventory_manage && query.includeInactive === '1' ? {} : { active: true }),
        ...(query.use ? { uses: { has: query.use } } : permitted ? { uses: { hasSome: permitted } } : {}),
        ...(typeof query.category === 'string' && query.category ? { category: query.category } : {}),
        ...(lowIds ? { id: { in: lowIds } } : {}),
        ...(query.status === 'expired' ? { lots: { some: { expiresOn: { lte: expiresAt }, balancePhysical: { gt: 0 } } } } : {}),
        ...(query.status === 'expiring' ? { lots: { some: { expiresOn: { gt: expiresAt, lte: soon }, balancePhysical: { gt: 0 } } } } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { internalCode: { equals: search, mode: 'insensitive' } }, { barcode: { equals: search } }] } : {}),
      }, include: { lots: { orderBy: [{ expiresOn: 'asc' }, { firstReceivedAt: 'asc' }, { id: 'asc' }] } },
      orderBy: { id: 'asc' }, take: limit + 1, ...(cursorId ? { cursor: { tenantId_id: { tenantId, id: cursorId } }, skip: 1 } : {}) });
      return { data: rows.slice(0, limit).map(p => dto(p, access, today)), nextCursor: rows.length > limit ? Buffer.from(JSON.stringify({ version: 1, id: rows[limit - 1].id, scope: cursorScope })).toString('base64url') : null, today };
    });
  }
  async function detail({ tenantId, actor, id }) {
    return unitOfWork.run(async ctx => {
      const access = await accessReader.readAccess({ tenantId, actor }, ctx);
      if (!access.capabilities.inventory_read) fail('ACCESS_DENIED', 'No tienes acceso al inventario.', 403);
      const p = await ctx.tx.inventoryProduct.findFirst({ where: { tenantId, id }, include: { lots: true } });
      const permitted = usesFor(access);
      if (!p || (permitted && (!p.active || !p.uses.some(u => permitted.includes(u))))) fail('PRODUCT_NOT_FOUND', 'Producto no encontrado.', 404);
      return dto(p, access, civilDateKey(clock()));
    });
  }
  async function movements({ tenantId, actor, id, cursor }) {
    return unitOfWork.run(async ctx => {
      const access = await accessReader.readAccess({ tenantId, actor }, ctx);
      if (!access.capabilities.inventory_manage) fail('ACCESS_DENIED', 'El historial completo requiere administración.', 403);
      if (!await ctx.tx.inventoryProduct.findFirst({ where: { tenantId, id }, select: { id: true } })) fail('PRODUCT_NOT_FOUND', 'Producto no encontrado.', 404);
      if (cursor && !await ctx.tx.inventoryMovement.findFirst({ where: { tenantId, productId: id, id: cursor }, select: { id: true } })) fail('INVALID_CURSOR', 'Actualiza el historial para continuar.', 400);
      const rows = await ctx.tx.inventoryMovement.findMany({ where: { tenantId, productId: id }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 101,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      return { data: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99].id : null };
    });
  }
  async function context({ tenantId, actor }) {
    return unitOfWork.run(async ctx => {
      const access = await accessReader.readAccess({ tenantId, actor }, ctx);
      if (!access.capabilities.inventory_read) fail('ACCESS_DENIED', 'No tienes acceso al inventario.', 403);
      return { scope: createHash('sha256').update(JSON.stringify([tenantId, access.principalKey, actor.sessionVersion ?? 0])).digest('hex') };
    });
  }
  return { list, detail, movements, context };
}
module.exports = { buildInventoryReads };
