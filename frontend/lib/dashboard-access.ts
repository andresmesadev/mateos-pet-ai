export type TeamRole = "admin" | "vet" | "groomer" | "receptionist";
export const ROLE_NAMES: Record<TeamRole, string> = { admin: "Administrador", vet: "Veterinario/a", groomer: "Peluquero/a", receptionist: "Recepción y caja" };
export type DashboardAccess = {
  role: TeamRole; staffId: string | null; activeModules: string[]; accessPermissions: string[]; navigation: string[];
  capabilities: { administration: boolean; finance: boolean; chat: boolean; contacts: boolean; agenda: boolean; schedule: boolean; clinical: boolean; grooming: boolean; cash: boolean; appointmentPrice: boolean; retail: boolean; services: boolean; inventory_read: boolean; inventory_manage: boolean; inventory_consume: boolean };
};
export function homeForRole(_role: TeamRole) { void _role; return "/dashboard"; }
export function canVisitDashboard(role: TeamRole, path: string) {
  if (role === "admin") return true;
  // Coarse session gate only; live backend access is checked by proxy.ts.
  return path.startsWith("/dashboard");
}
