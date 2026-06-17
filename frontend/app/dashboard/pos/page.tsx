import { PosForm } from "@/components/dashboard/pos-form";

export default function PosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva venta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra el cobro de un servicio. Los ítems quedan guardados en el historial de ingresos.
        </p>
      </div>
      <PosForm />
    </div>
  );
}
