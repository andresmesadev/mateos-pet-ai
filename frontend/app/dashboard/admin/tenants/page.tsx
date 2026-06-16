import { TenantsTable } from "@/components/dashboard/tenants-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

function TenantsLoading() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function AdminTenantsPage() {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Veterinarias
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestión de todos los tenants de la plataforma Mateos Pet AI SaaS
        </p>
      </div>

      <Suspense fallback={<TenantsLoading />}>
        <TenantsTable />
      </Suspense>
    </section>
  );
}
