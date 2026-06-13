import { PetsTable } from "@/components/dashboard/pets-table";

export default function DashboardPetsPage() {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Mascotas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta y administra el historial médico de cada paciente
        </p>
      </div>

      <PetsTable />
    </section>
  );
}
