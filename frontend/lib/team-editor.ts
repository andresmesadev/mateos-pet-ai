import { displayedDay, readHoursDraft, WEEK_DAYS } from "@/lib/business-hours-editor";

export type TimeWindow = { open: string; close: string };
export type DaySlot = { active: boolean; open: string; close: string; windows?: TimeWindow[] };
export type Availability = Record<string, DaySlot>;
export type StaffMember = { id: string; name: string; role: string; active: boolean; email: string | null; phone: string | null; availability: Availability | null; serviceScope?: string; accessPermissions?: string[]; credential?: { email: string; active: boolean } | null };
export const TEAM_ROLES = [
  { value: "vet", label: "Veterinario/a", description: "Consultas veterinarias, agenda de su área y WhatsApp. Caja requiere permiso adicional." },
  { value: "groomer", label: "Peluquero/a", description: "Atenciones y notas de peluquería, agenda de su área y WhatsApp. Caja requiere permiso adicional." },
  { value: "receptionist", label: "Recepción y caja", description: "Crea citas, gestiona clientes, responde WhatsApp y cobra en Caja. Los reportes generales y la edición clínica pertenecen a otros perfiles." },
  { value: "admin", label: "Administrador", description: "Gestiona las áreas habilitadas, el equipo, las tarifas, Caja y los reportes; también puede atender y responder WhatsApp." },
];
export const teamText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
export function memberFormError(form: { name: string; email: string }): string | null {
  if (!form.name.trim()) return "Escribe el nombre del integrante.";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Escribe un correo válido o deja el campo vacío.";
  return null;
}
export function availabilityError(availability: Availability | null): string | null {
  if (!availability) return null;
  for (const { key, label } of WEEK_DAYS) {
    const day = availability[key];
    if (!day?.active) continue;
    const valid = /^([01]\d|2[0-3]):[0-5]\d$/;
    const windows = day.windows ?? [{open:day.open,close:day.close}];
    if (!windows.length) return `${label}: agrega una franja de trabajo.`;
    if (windows.length > 8) return `${label}: configura hasta ocho franjas.`;
    for (const window of windows) {
      if (!valid.test(window.open) || !valid.test(window.close)) return `${label}: indica entrada y salida con horas y minutos.`;
      if (window.open >= window.close) return `${label}: la salida debe ser posterior a la entrada.`;
    }
    const ordered = [...windows].sort((a,b)=>a.open.localeCompare(b.open));
    if (ordered.some((window,i)=>i>0 && ordered[i-1].close>window.open)) return `${label}: las franjas no pueden superponerse.`;
  }
  return null;
}
export function suggestedStaffWeek(businessHours: unknown, role: string): Availability {
  const draft = readHoursDraft(businessHours as Parameters<typeof readHoursDraft>[0]);
  const area = role === "vet" ? draft.services.vet : role === "groomer" ? draft.services.grooming : undefined;
  return Object.fromEntries(WEEK_DAYS.map(({ key }) => [key, { ...displayedDay(key, area ?? draft.general, area ? draft.general : undefined) }]));
}
