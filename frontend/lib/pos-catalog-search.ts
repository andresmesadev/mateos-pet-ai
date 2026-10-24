import type { InventoryProduct } from './inventory';
import type { CheckoutLine } from './pos-checkout';

export type CatalogFilter = 'all' | 'products' | 'services';
export type CatalogService = { id: string; name: string; category: string; price: number | null; priceSource: string; appliesCommissionSplit?: boolean };
export type CatalogEntry = { kind: 'product'; key: string; product: InventoryProduct } | { kind: 'service'; key: string; service: CatalogService };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function catalogEntries(products: InventoryProduct[], services: CatalogService[], query: string, filter: CatalogFilter): CatalogEntry[] {
  return [
    ...(filter === 'services' ? [] : products.map(product => ({ kind: 'product' as const, key: `product:${product.id}`, product }))),
    ...(filter === 'products' ? [] : services.filter(service => normalize(service.name).includes(normalize(query))).map(service => ({ kind: 'service' as const, key: `service:${service.id}`, service }))),
  ];
}

export function exactCatalogProduct(products: InventoryProduct[], query: string): InventoryProduct | undefined {
  const code = query.trim();
  return code ? products.find(product => product.barcode === code || product.internalCode.toLowerCase() === code.toLowerCase()) : undefined;
}

export function catalogProductAvailable(product: InventoryProduct, quantities: Record<string, number>): boolean {
  return product.active && product.uses.includes('retail') && (product.salePrice ?? 0) > 0 && /^\d+$/.test(product.available) &&
    BigInt(product.available) > BigInt(quantities[product.id] ?? 0);
}

export function catalogServiceLine(service: CatalogService, petId: string, petName: string): CheckoutLine {
  const unitPrice = service.price !== null && service.price > 0 ? String(service.price) : '';
  return { id: crypto.randomUUID(), serviceId: service.id, description: service.name, quantity: '1', unitPrice, itemKind: 'service',
    commissionSplit: service.appliesCommissionSplit === true, serviceCategory: service.category,
    ...(unitPrice ? { serviceQuote: { source: ['pet_agreed_price', 'pet_default_price'].includes(service.priceSource) ? 'pet' : 'catalog', petId, petName, unitPrice, description: service.name } } : {}) };
}
