import { Suspense } from "react";
import { PawPrint } from "lucide-react";

import { PetsTable } from "@/components/dashboard/pets-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";

function PetsLoading() {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
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
      <PageHeader
        title="Mascotas"
        description="Consulta y administra el historial médico de cada paciente"
        icon={PawPrint}
        tint="bg-amber-500/15 text-amber-400"
      />

      <Suspense fallback={<PetsLoading />}>
        <PetsTable initialPetId={params.pet ?? null} />
      </Suspense>
    </section>
  );
}
