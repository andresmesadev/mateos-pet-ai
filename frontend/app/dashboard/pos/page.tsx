import { ShoppingCart } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PosForm } from "@/components/dashboard/pos-form";

export default function PosPage() {
  return (
    <div>
      <PageHeader
        title="Nueva venta"
        description="Registra el cobro de un servicio. Los ítems quedan en el historial de ingresos"
        icon={ShoppingCart}
        tint="bg-teal-500/15 text-teal-400"
      />
      <PosForm />
    </div>
  );
}
