// Prisma may wrap PostgreSQL conflicts, or expose DriverAdapterError directly
// when the failure happens at COMMIT. Both representations mean rollback.
function serializationConflict(error) {
  const code = error?.meta?.code || error?.meta?.driverAdapterError?.cause?.originalCode || error?.cause?.originalCode;
  return error?.code === 'P2034' || ['40001','40P01'].includes(code);
}
const yieldRetry = attempt => new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt + Math.floor(Math.random() * 30)));
module.exports = { serializationConflict, yieldRetry };
