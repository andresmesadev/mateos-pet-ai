import { Suspense } from "react";
import { Building2 } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { TenantsTable } from "@/components/dashboard/tenants-table";
import { Skeleton } from "@/components/ui/skeleton";

function TenantsLoading() {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function AdminTenantsPage() {
  return (
    <section>
      <PageHeader
        title="Veterinarias"
        description="Gestión de todos los tenants de la plataforma Mateos Pet AI SaaS"
        icon={Building2}
        tint="bg-indigo-500/15 text-indigo-400"
      />

      <Suspense fallback={<TenantsLoading />}>
        <TenantsTable />
      </Suspense>
    </section>
  );
}
