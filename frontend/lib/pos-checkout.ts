export type CheckoutLine = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  itemKind: "service" | "product";
  productId?: string;
  priceVersion?: number;
  presentation?: string;
  // Display-only quote from the existing resolver; never sent as a pricing command.
  serviceQuote?: { source: "catalog" | "pet"; petId: string; petName: string; unitPrice: string; description: string };
};

export function checkoutPriceLabel(line: CheckoutLine): string {
  if (line.productId) return "Precio del catálogo";
  const quote = line.serviceQuote;
  if (!quote) return "Precio ingresado";
  if (quote.description !== line.description || moneyInCents(quote.unitPrice) !== moneyInCents(line.unitPrice)) return "Precio editado";
  return quote.source === "pet" ? `Tarifa de ${quote.petName || "la mascota"}` : "Precio del catálogo";
}

const MAX_CENTS = 9_999_999_999;
export const MAX_POS_QUANTITY = 2_147_483_647;

export type CatalogueSnapshot = {
  id: string; name: string; active: boolean; uses: string[]; available: string;
  salePrice?: number | null; priceVersion: number; presentation: string; internalCode: string;
};

export function productQuantities(lines: CheckoutLine[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const line of lines) {
    if (line.productId && /^\d+$/.test(line.quantity) && Number.isSafeInteger(Number(line.quantity))) {
      quantities[line.productId] = (quantities[line.productId] ?? 0) + Number(line.quantity);
    }
  }
  return quantities;
}

// Only identical SKU/price snapshots merge. A scan never replaces an agreed price silently.
export function addCheckoutLine(lines: CheckoutLine[], incoming: CheckoutLine): { lines: CheckoutLine[]; error: string | null } {
  const existing = incoming.productId ? lines.find(line => line.productId === incoming.productId) : undefined;
  if (existing) {
    if (existing.priceVersion !== incoming.priceVersion || moneyInCents(existing.unitPrice) !== moneyInCents(incoming.unitPrice)) {
      return { lines, error: `${incoming.description}: el precio cambió. Actualiza el precio de la fila antes de agregar otra unidad.` };
    }
    const quantity = Number(existing.quantity) + Number(incoming.quantity);
    if (!/^\d+$/.test(existing.quantity) || !/^\d+$/.test(incoming.quantity) || Number(existing.quantity) < 1 || Number(incoming.quantity) < 1 || !Number.isSafeInteger(quantity) || quantity > MAX_POS_QUANTITY) {
      return { lines, error: `${incoming.description}: revisa la cantidad de la fila antes de agregar otra unidad.` };
    }
    return { lines: lines.map(line => line.id === existing.id ? { ...line, quantity: String(quantity) } : line), error: null };
  }
  if (lines.length >= 100) return { lines, error: "Esta venta admite hasta 100 artículos. Confirma o vacía la preparación para continuar." };
  return { lines: [...lines, incoming], error: null };
}

export function catalogueLineIssue(line: CheckoutLine, product: CatalogueSnapshot, quantity: number): string | null {
  if (!product.active || !product.uses.includes("retail")) return "Este producto ya no está habilitado para venta. Retíralo del carrito.";
  if (!product.salePrice || product.priceVersion !== line.priceVersion || moneyInCents(String(product.salePrice)) !== moneyInCents(line.unitPrice)) return "El precio del catálogo cambió. Actualiza el precio y revisa el total antes de cobrar.";
  if (!/^\d+$/.test(product.available)) return "No se pudo comprobar la disponibilidad. Actualiza el producto antes de cobrar.";
  if (Number.isSafeInteger(quantity) && quantity > 0 && BigInt(quantity) > BigInt(product.available)) return `Solo hay ${product.available} unidades disponibles. Reduce la cantidad o retira el producto.`;
  return null;
}

// Prices are entered without thousands separators. Both decimal marks work.
export function moneyInCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return cents <= MAX_CENTS ? cents : null;
}

export function lineTotalCents(line: CheckoutLine): number {
  const price = moneyInCents(line.unitPrice);
  const quantity = Number(line.quantity);
  return price !== null && /^\d+$/.test(line.quantity) && Number.isSafeInteger(quantity) && quantity > 0 && Number.isSafeInteger(price * quantity)
    ? price * quantity : 0;
}

export function validateCheckout(lines: CheckoutLine[], capabilities: { services: boolean; retail: boolean }): string | null {
  if (!lines.length) return "Agrega al menos un producto o servicio.";
  let total = 0;
  for (const [index, line] of lines.entries()) {
    const prefix = `Artículo ${index + 1}: `;
    if (!line.description.trim()) return prefix + "escribe una descripción.";
    if (line.productId && (!Number.isInteger(line.priceVersion) || line.priceVersion! < 1 || line.itemKind !== "product")) return prefix + "vuelve a seleccionar el producto del inventario.";
    if (!/^\d+$/.test(line.quantity) || !Number.isSafeInteger(Number(line.quantity)) || Number(line.quantity) < 1 || Number(line.quantity) > MAX_POS_QUANTITY) return prefix + "la cantidad debe ser un número entero mayor que cero, hasta 2.147.483.647 unidades.";
    const cents = moneyInCents(line.unitPrice);
    if (cents === null || cents <= 0) return prefix + "ingresa un precio mayor que cero, sin separadores de miles y con máximo dos decimales.";
    if (line.itemKind === "service" ? !capabilities.services : line.itemKind === "product" ? !capabilities.retail : true) return prefix + "ese tipo de venta no está habilitado.";
    total += cents * Number(line.quantity);
    if (!Number.isSafeInteger(total) || total > MAX_CENTS) return "El total supera el límite de 99.999.999,99 COP.";
  }
  return null;
}

export function cashChange(totalCents: number, received: string): { change: number; missing: number } | null {
  const cents = moneyInCents(received);
  if (cents === null) return null;
  return { change: Math.max(0, cents - totalCents) / 100, missing: Math.max(0, totalCents - cents) / 100 };
}

export function formatPosMoney(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}
