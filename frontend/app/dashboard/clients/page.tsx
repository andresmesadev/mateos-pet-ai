import { Suspense } from "react";

import { ClientsTable } from "@/components/dashboard/clients-table";
import { Skeleton } from "@/components/ui/skeleton";

function ClientsLoading() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function DashboardClientsPage() {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta el perfil completo de cada cliente de la veterinaria
        </p>
      </div>

      <Suspense fallback={<ClientsLoading />}>
        <ClientsTable />
      </Suspense>
    </section>
  );
}
