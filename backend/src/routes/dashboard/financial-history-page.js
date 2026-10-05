const { Prisma } = require("@prisma/client");
const { bogotaDayStart } = require("./shared");

class HistoryQueryError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

function readHistoryQuery(query, kind) {
  const value = (key, fallback = "") => {
    if (query[key] === undefined) return fallback;
    if (typeof query[key] !== "string") throw new HistoryQueryError("Los parámetros de consulta no pueden repetirse.");
    return query[key];
  };
  const from = value("from"), to = value("to");
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(from) || !validDate(to) || from > to) throw new HistoryQueryError("Selecciona un rango de fechas válido.");
  const integer = (key, fallback, maximum) => {
    const raw = value(key, String(fallback));
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > maximum) throw new HistoryQueryError("La página o su tamaño no son válidos.");
    return Number(raw);
  };
  const choice = (key, choices) => {
    const raw = value(key, "all");
    if (!choices.includes(raw)) throw new HistoryQueryError("Uno de los filtros no es válido.");
    return raw;
  };
  if (value("pagination") !== "1") throw new HistoryQueryError("La paginación no es válida.");
  const search = value("search");
  if (search.length > 200) throw new HistoryQueryError("La búsqueda admite hasta 200 caracteres.");
  return {
    from, to, page: integer("page", 1, 1_000_000), pageSize: integer("pageSize", 10, 50),
    status: choice("status", ["all", "active", "voided"]),
    ...(kind === "transactions" ? {
      method: choice("method", ["all", "cash", "transfer", "card", "other", "review"]),
      origin: choice("origin", ["all", "manual_pos_sale", "system_appointment_completed", "legacy"]),
    } : { category: choice("category", ["all", "supplies", "utilities", "rent", "salary", "equipment", "marketing", "other"]) }),
    terms: search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim().split(/\s+/).filter(Boolean),
  };
}

// Only fixed adapter identifiers enter SQL. All user values remain parameters.
function historySql(kind, tenantId, query) {
  const transactions = kind === "transactions";
  const source = transactions ? Prisma.sql`"Transaction" t` : Prisma.sql`"Expense" t`;
  const date = transactions ? Prisma.sql`t."paidAt"` : Prisma.sql`t."date"`;
  const amount = transactions ? Prisma.sql`t."total"` : Prisma.sql`t."amount"`;
  const conditions = [Prisma.sql`t."tenantId" = ${tenantId}`, Prisma.sql`${date} >= ${bogotaDayStart(query.from)}`, Prisma.sql`${date} < ${new Date(bogotaDayStart(query.to).getTime() + 86_400_000)}`];
  if (query.status !== "all") conditions.push(Prisma.sql`t."status" = ${query.status}`);
  const review = Prisma.sql`(t."origin" = 'system_appointment_completed' AND (t."recordedActorId" IS NULL OR t."recordedActorId" = ''))`;
  if (transactions) {
    if (query.origin !== "all") conditions.push(Prisma.sql`COALESCE(t."origin", 'legacy') = ${query.origin}`);
    if (query.method === "review") conditions.push(review);
    else if (query.method !== "all") conditions.push(Prisma.sql`t."paymentMethod" = ${query.method} AND NOT ${review}`);
  } else if (query.category !== "all") conditions.push(Prisma.sql`t."category" = ${query.category}`);
  const haystack = transactions ? Prisma.sql`concat_ws(' ', t."id", t."recordedActorName",
    (SELECT concat_ws(' ', u."name", u."phone") FROM "User" u WHERE u."id" = t."userId"),
    (SELECT p."name" FROM "Pet" p WHERE p."id" = t."petId"),
    (SELECT string_agg(i."description", ' ') FROM "TransactionItem" i WHERE i."transactionId" = t."id"))`
    : Prisma.sql`concat_ws(' ', t."id", t."description", t."responsible")`;
  for (const term of query.terms) {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(Prisma.sql`regexp_replace(normalize(lower(${haystack}), NFD), ${"[\u0300-\u036f]"}, '', 'g') LIKE ${pattern}`);
  }
  return { source, date, amount, where: Prisma.join(conditions, " AND ") };
}

async function readFinancialHistoryPage(prisma, kind, tenantId, query, include, mapRow) {
  if (!tenantId) throw new HistoryQueryError("Selecciona un establecimiento para consultar su historial.");
  const sql = historySql(kind, tenantId, query);
  return prisma.$transaction(async tx => {
    const [totals] = await tx.$queryRaw(Prisma.sql`SELECT count(*)::int AS "total",
      count(*) FILTER (WHERE t."status" = 'active')::int AS "activeCount",
      count(*) FILTER (WHERE t."status" = 'voided')::int AS "voidedCount",
      COALESCE(sum(${sql.amount}) FILTER (WHERE t."status" = 'active'), 0) AS "activeTotal"
      FROM ${sql.source} WHERE ${sql.where}`);
    const totalPages = Math.max(1, Math.ceil(totals.total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const ids = await tx.$queryRaw(Prisma.sql`SELECT t."id" FROM ${sql.source} WHERE ${sql.where}
      ORDER BY ${sql.date} DESC, t."id" DESC LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}`);
    const model = kind === "transactions" ? tx.transaction : tx.expense;
    const rows = ids.length ? await model.findMany({ where: { tenantId, id: { in: ids.map(row => row.id) } }, ...(include ? { include } : {}) }) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    return { data: ids.map(({ id }) => mapRow(byId.get(id))), total: totals.total, page, pageSize: query.pageSize, totalPages,
      summary: { activeCount: totals.activeCount, voidedCount: totals.voidedCount, activeTotal: Number(totals.activeTotal) } };
  }, { isolationLevel: "RepeatableRead" });
}

module.exports = { HistoryQueryError, readHistoryQuery, historySql, readFinancialHistoryPage };
