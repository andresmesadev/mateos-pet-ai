import { StaffManager } from "@/components/dashboard/staff-manager";

export default function StaffPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-muted-foreground">
          Gestiona los miembros del equipo: veterinarios, peluqueros y administrativos.
        </p>
      </div>

      <StaffManager />
    </div>
  );
}
