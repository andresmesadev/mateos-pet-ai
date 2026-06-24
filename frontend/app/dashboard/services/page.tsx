import { Scissors } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ServicesManager } from "@/components/dashboard/services-manager";

export default function ServicesPage() {
  return (
    <div>
      <PageHeader
        title="Servicios"
        description="Catálogo de servicios disponibles para el agente y los clientes"
        icon={Scissors}
        tint="bg-pink-500/15 text-pink-400"
      />
      <ServicesManager />
    </div>
  );
}
