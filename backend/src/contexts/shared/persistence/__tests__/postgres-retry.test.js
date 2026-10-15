const { serializationConflict } = require('../postgres-retry');
test.each([{code:'P2034'},{code:'P2010',meta:{code:'40001'}},{meta:{driverAdapterError:{cause:{originalCode:'40P01'}}}},{cause:{originalCode:'40001',kind:'TransactionWriteConflict'}}])('recognizes a rolled-back PostgreSQL conflict: %j',error=>{
  expect(serializationConflict(error)).toBe(true);
});
test.each([{code:'P2002'},{cause:{originalCode:'23514'}},new Error('connection lost'),null])('never interprets a constraint or unknown result as safe to replay: %j',error=>{
  expect(serializationConflict(error)).toBe(false);
});
