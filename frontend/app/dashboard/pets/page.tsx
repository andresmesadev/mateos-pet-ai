import { Suspense } from "react";

import { PetsTable } from "@/components/dashboard/pets-table";
import { Skeleton } from "@/components/ui/skeleton";

function PetsLoading() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

type DashboardPetsPageProps = {
  searchParams: Promise<{
    pet?: string;
  }>;
};

export default async function DashboardPetsPage({
  searchParams,
}: DashboardPetsPageProps) {
  const params = await searchParams;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Mascotas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta y administra el historial médico de cada paciente
        </p>
      </div>

      <Suspense fallback={<PetsLoading />}>
        <PetsTable initialPetId={params.pet ?? null} />
      </Suspense>
    </section>
  );
}
