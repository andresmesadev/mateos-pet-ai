import { Suspense } from "react";
import { Users } from "lucide-react";

import { ClientsTable } from "@/components/dashboard/clients-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";

function ClientsLoading() {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function DashboardClientsPage() {
  return (
    <section>
      <PageHeader
        title="Clientes"
        description="Perfiles registrados por WhatsApp y su actividad reciente"
        icon={Users}
        tint="bg-violet-500/15 text-violet-400"
      />

      <Suspense fallback={<ClientsLoading />}>
        <ClientsTable />
      </Suspense>
    </section>
  );
}
