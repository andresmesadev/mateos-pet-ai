export type PaymentMethod = "cash" | "transfer" | "card" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     "Efectivo",
  transfer: "Transferencia",
  card:     "Tarjeta",
  other:    "Otro",
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  cash:     "💵",
  transfer: "🏦",
  card:     "💳",
  other:    "🔖",
};

export type TransactionItem = {
  productId?: string | null;
  productCode?: string | null;
  presentation?: string | null;
  priceVersion?: number | null;
  priceSource?: string | null;
  inventoryReturn?: { id: string; disposition: "restock" | "discard"; quantity: number; recordedAt: string } | null;
  id: string;
  description: string;
  itemKind?: "product" | "service" | "legacy";
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Transaction = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  petId: string | null;
  petName: string | null;
  petType: string | null;
  appointmentId: string | null;
  origin?: "manual_pos_sale" | "system_appointment_completed" | "legacy";
  status?: "active" | "voided";
  voidedAt?: string | null;
  voidReason?: string | null;
  total: number;
  paymentMethod: PaymentMethod;
  recordedBy?: { id: string; name: string | null; role: string | null } | null;
  notes: string | null;
  paidAt: string;
  createdAt: string;
  items: TransactionItem[];
};

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTransactionDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
