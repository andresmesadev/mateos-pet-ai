const { Prisma } = require("@prisma/client");
const { readHistoryQuery, historySql, HistoryQueryError } = require("./financial-history-page");
const { getBogotaYmd, mapTransaction } = require("./shared");

function cashQuery(input, access) {
  const today = getBogotaYmd();
  const value = (key, fallback) => {
    if (input[key] === undefined) return fallback;
    if (typeof input[key] !== "string") throw new HistoryQueryError("Los parámetros de consulta no pueden repetirse.");
    return input[key];
  };
  const scope = value("scope", "day"), date = value("date", today), filter = value("filter", "all");
  if (!["day", "pending"].includes(scope) || !["all", "review", "registered"].includes(filter)) throw new HistoryQueryError("El filtro de Caja no es válido.");
  const query = readHistoryQuery({ ...input, from: date, to: date, pagination: "1", status: "active", origin: "all" }, "transactions");
  if (date > today) throw new HistoryQueryError("Selecciona hoy o una fecha anterior.");
  if (scope === "day" && !access?.capabilities.administration && date !== today) {
    const error = new HistoryQueryError("Tu acceso permite consultar la jornada de hoy y los cobros pendientes de todas las fechas.");
    error.status = 403; throw error;
  }
  if (scope === "pending" && query.method !== "all") throw new HistoryQueryError("Los cobros pendientes todavía no tienen un método confirmado.");
  if (scope === "pending" || filter === "review") query.method = "review";
  query.confirmedOnly = scope === "day" && filter === "registered";
  return { query, scope, date };
}

async function readOperationalCash(prisma, tenantId, input, access) {
  if (!tenantId) throw new HistoryQueryError("Selecciona un establecimiento.");
  const { query, scope, date } = cashQuery(input, access);
  const sql = historySql("transactions", tenantId, query, { allDates: scope === "pending" });
  const review = Prisma.sql`(t."origin" = 'system_appointment_completed' AND (t."recordedActorId" IS NULL OR t."recordedActorId" = ''))`;
  return prisma.$transaction(async tx => {
    const groups = await tx.$queryRaw(Prisma.sql`SELECT ${review} AS "review", t."paymentMethod" AS "method", count(*)::int AS "count", COALESCE(sum(t."total"), 0) AS "amount"
      FROM ${sql.source} WHERE ${sql.where} GROUP BY ${review}, t."paymentMethod"`);
    const [pending] = await tx.$queryRaw(Prisma.sql`SELECT count(*)::int AS "count" FROM "Transaction" t WHERE t."tenantId" = ${tenantId} AND t."status" = 'active' AND ${review}`);
    const summaryCash = { methods: Object.fromEntries(["cash", "transfer", "card", "other"].map(method => [method, { count: 0, cents: 0 }])), reviewCount: 0, reviewCents: 0 };
    let total = 0, totalCents = 0;
    for (const group of groups) {
      const cents = Math.round(Number(group.amount) * 100);
      total += group.count; totalCents += cents;
      if (group.review) { summaryCash.reviewCount += group.count; summaryCash.reviewCents += cents; }
      else if (summaryCash.methods[group.method]) summaryCash.methods[group.method] = { count: group.count, cents };
    }
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize)), page = Math.min(query.page, totalPages);
    const ids = await tx.$queryRaw(Prisma.sql`SELECT t."id" FROM ${sql.source} WHERE ${sql.where} ORDER BY t."paidAt" DESC, t."id" DESC LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}`);
    const rows = ids.length ? await tx.transaction.findMany({ where: { tenantId, id: { in: ids.map(row => row.id) } }, include: { user: { select: { name: true, phone: true } }, pet: { select: { name: true, type: true } }, items: { include: { inventoryReturn: true } } } }) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    const data = ids.map(({ id }) => mapTransaction(byId.get(id)));
    return { date, scope, data, transactions: data, toReview: rows.filter(row => row.origin === "system_appointment_completed" && !row.recordedActorId).map(row => row.id),
      total, page, pageSize: query.pageSize, totalPages, summary: { activeCount: total, voidedCount: 0, activeTotal: totalCents / 100 }, totalRegistered: totalCents / 100, summaryCash, pendingCount: pending.count, hasMore: page < totalPages };
  }, { isolationLevel: "RepeatableRead" });
}

module.exports = { cashQuery, readOperationalCash };
