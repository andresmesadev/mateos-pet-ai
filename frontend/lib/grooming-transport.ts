export type TransportDraft = { mode: string; zoneId: string; address: string; neighborhood: string; amount: string; confirmed: boolean; sharedWithId: string; scope: string };
export const emptyTransport: TransportDraft = { mode: "", zoneId: "", address: "", neighborhood: "", amount: "", confirmed: false, sharedWithId: "", scope: "" };
export type TransportZone = { id: string; name: string; roundTripPrice: number | string | null; pickupPrice: number | string | null; deliveryPrice: number | string | null; active: boolean };
export function transportPayload(value: TransportDraft) {
  return { mode: value.mode, zoneId: value.zoneId || null, address: value.address.trim(), neighborhood: value.neighborhood.trim(),
    amount: value.mode !== "none" && value.mode !== "shared" && value.amount.trim() ? Number(value.amount) : null,
    confirmed: value.confirmed, sharedWithId: value.sharedWithId || null, scope: value.scope.trim() };
}
export const transportLabels: Record<string, string> = { none: "La traen al centro", round_trip: "Recogida y entrega", pickup: "Solo recogida", delivery: "Solo entrega", shared: "Incluido en el domicilio de otra cita" };
