import { type TodayAppointment } from "@/lib/appointments";

export type GroomingVisit = TodayAppointment & {
  groomingNotes: string | null;
  groomingNotesVersion: number;
  groomingNotesUpdatedAt: string | null;
  groomingDeliveredAt: string | null;
};

export const GROOMING_STAGES = ["Por recibir", "En espera", "En baño o corte", "Listas para entrega", "Entregadas", "Por revisar", "Canceladas / No asistieron"] as const;

export function groomingStage(visit: GroomingVisit, today: string): typeof GROOMING_STAGES[number] {
  if (["cancelled", "no_show"].includes(visit.status)) return "Canceladas / No asistieron";
  if (visit.status === "completed") return visit.groomingDeliveredAt ? "Entregadas" : "Listas para entrega";
  const day = new Date(visit.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  if (day < today) return "Por revisar";
  if (visit.status === "in_progress") return "En baño o corte";
  if (visit.status === "arrived") return "En espera";
  return "Por recibir";
}
