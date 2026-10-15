// Prisma's installed pg adapter decodes timestamptz as UTC wall time. Keep every
// pooled connection in UTC; business-day rules still use their explicit zone.
function prismaPoolConfig(connectionString) {
  if (!connectionString) return { options: '-c timezone=UTC' };
  const url = new URL(connectionString);
  const options = url.searchParams.get('options') || '';
  url.searchParams.set('options', `${options} -c timezone=UTC`.trim());
  return { connectionString: url.toString() };
}
module.exports = { prismaPoolConfig };
