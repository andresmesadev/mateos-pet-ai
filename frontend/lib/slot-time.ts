/** Preserve all configured minutes when displaying a decimal-hour slot. */
export function slotTimeLabel(hour: number): string {
  const total = Math.round(hour * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
