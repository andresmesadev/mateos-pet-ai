import type { CheckoutLine } from "./pos-checkout";
import type { PaymentMethod } from "./transactions";

export type DraftClient = { id: string; name: string | null; phone: string; pets: { id: string; name: string; type: string }[] };
export type SaleDraft = {
  version: 1; scope: string; updatedAt: number; stage: "preparing" | "verify";
  lines: CheckoutLine[]; client: DraftClient | null; petId: string;
  paymentMethod: PaymentMethod; received: string; notes: string;
  operationKey?: string;
  operationBody?: string;
};
export function draftKey(scope: string) { return `mateos-pos-draft-v1:${scope}`; }
export function pendingSaleKey(scope: string) { return `mateos-pos-pending-v1:${scope}`; }
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function readStoredDraft(session: DraftStorage, durable: DraftStorage, scope: string): SaleDraft | null {
  const pending = readDraft(durable.getItem(pendingSaleKey(scope)), scope);
  if (pending?.stage === "verify" && pending.operationKey) return pending;
  const previous = readDraft(session.getItem(draftKey(scope)), scope);
  if (previous?.stage === "verify" && previous.operationKey) durable.setItem(pendingSaleKey(scope), JSON.stringify(previous));
  return previous;
}
export function writeStoredDraft(session: DraftStorage, durable: DraftStorage, draft: SaleDraft) {
  const pending = readDraft(durable.getItem(pendingSaleKey(draft.scope)), draft.scope);
  if (pending?.stage === "verify" && pending.operationKey && pending.operationKey !== draft.operationKey) {
    throw new Error("Hay un cobro pendiente en otra pestaña. Consulta su resultado antes de iniciar otra venta.");
  }
  // Uncertain operations survive closing the tab. Preparations remain temporary.
  if (draft.stage === "verify" && draft.operationKey) durable.setItem(pendingSaleKey(draft.scope), JSON.stringify(draft));
  else durable.removeItem(pendingSaleKey(draft.scope));
  session.setItem(draftKey(draft.scope), JSON.stringify(draft));
}
export function removeStoredDraft(session: DraftStorage, durable: DraftStorage, scope: string) {
  durable.removeItem(pendingSaleKey(scope));
  session.removeItem(draftKey(scope));
}
export function clearSaleDrafts(storage: Pick<Storage, "length" | "key" | "removeItem">) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key?.startsWith("mateos-pos-draft-v1:")) storage.removeItem(key);
  }
}
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
export function readDraft(raw: string | null, scope: string, now = Date.now()): SaleDraft | null {
  if (!raw || raw.length > 100000) return null;
  try {
    const draft = JSON.parse(raw) as SaleDraft;
    if (draft.operationKey !== undefined && (typeof draft.operationKey !== "string" || !/^[a-f0-9-]{36}$/i.test(draft.operationKey))) return null;
    if (draft.operationBody !== undefined && (!text(draft.operationBody, 100000) || !draft.operationKey)) return null;
    if (draft.version !== 1 || draft.scope !== scope || !Number.isFinite(draft.updatedAt) ||
      draft.updatedAt > now + 60000 || !["preparing", "verify"].includes(draft.stage) ||
      (draft.stage === "preparing" && now - draft.updatedAt > 12 * 60 * 60 * 1000)) return null;
    if (!Array.isArray(draft.lines) || draft.lines.length > 100 || !draft.lines.every(line =>
      line && text(line.id, 100) && text(line.description, 250) && text(line.quantity, 20) && text(line.unitPrice, 30) && ["service", "product"].includes(line.itemKind) &&
      (line.productId === undefined || (text(line.productId, 100) && Number.isInteger(line.priceVersion) && line.priceVersion! > 0)) && (line.presentation === undefined || text(line.presentation, 80)) &&
      (line.serviceQuote === undefined || (line.itemKind === "service" && line.serviceQuote && ["catalog", "pet"].includes(line.serviceQuote.source) && text(line.serviceQuote.petId, 100) && text(line.serviceQuote.petName, 250) && text(line.serviceQuote.unitPrice, 30) && text(line.serviceQuote.description, 250))))) return null;
    if (!text(draft.petId, 100) || !text(draft.received, 30) || !text(draft.notes, 2000) ||
      !["cash", "transfer", "card", "other"].includes(draft.paymentMethod)) return null;
    const client = draft.client;
    if (client !== null && (!client || !text(client.id, 100) || !(client.name === null || text(client.name, 250)) ||
      !text(client.phone, 100) || !Array.isArray(client.pets) || client.pets.length > 20 || !client.pets.every(pet =>
        pet && text(pet.id, 100) && text(pet.name, 250) && text(pet.type, 100)))) return null;
    if (draft.petId && !client?.pets.some(pet => pet.id === draft.petId)) return null;
    return draft;
  } catch { return null; }
}
