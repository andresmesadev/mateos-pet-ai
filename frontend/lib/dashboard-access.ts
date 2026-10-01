export type TeamRole = "admin" | "vet" | "groomer" | "receptionist";
export const ROLE_NAMES: Record<TeamRole, string> = { admin: "Administrador", vet: "Veterinario/a", groomer: "Peluquero/a", receptionist: "Recepción" };
export function homeForRole(role: TeamRole) { return role === "vet" ? "/dashboard/consultas" : role === "admin" ? "/dashboard" : "/dashboard/conversations"; }
export function canVisitDashboard(role: TeamRole, path: string) {
  if (role === "admin") return true;
  return path === "/dashboard/conversations" || (role === "vet" && path === "/dashboard/consultas");
}
