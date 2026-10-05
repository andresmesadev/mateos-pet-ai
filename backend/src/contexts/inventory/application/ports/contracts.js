// Structural ports consumed by application commands. Implementations must use
// the supplied opaque ctx; no global-client fallback is permitted in a command.
const contracts = Object.freeze({
  ProductRepository: ['findProduct', 'lockProducts', 'createProduct', 'updateProduct', 'bumpStock'],
  StockRepository: ['lots', 'findLot', 'createLot', 'changeBalance'],
  MovementRepository: ['recordMovement', 'movements', 'compensatedQuantity'],
  OperationRepository: ['findOperation', 'createOperation'],
  AccessReader: ['readAccess'],
  AttentionAccessReader: ['attention'],
  SaleReader: ['lockSale', 'sale'],
});
function assertPorts(ports) {
  for (const [name, methods] of Object.entries(contracts)) for (const method of methods) {
    if (typeof ports[name]?.[method] !== 'function') throw new Error(`${name}.${method} missing`);
  }
}
module.exports = { contracts, assertPorts };
