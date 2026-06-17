import { ServicesManager } from "@/components/dashboard/services-manager";

export default function ServicesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Servicios</h1>
        <p className="text-muted-foreground">
          Gestiona el catálogo de servicios disponibles para el agente y los clientes.
        </p>
      </div>

      <ServicesManager />
    </div>
  );
}
