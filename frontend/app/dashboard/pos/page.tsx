import { Suspense } from "react";
import { Wallet } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PosTabs, type PosTab } from "@/components/dashboard/pos/pos-tabs";
import { SaleForm } from "@/components/dashboard/pos/sale-form";
import { ExpenseForm } from "@/components/dashboard/pos/expense-form";
import { CashboxView } from "@/components/dashboard/pos/cashbox-view";
import { RevenueHistory } from "@/components/dashboard/pos/revenue-history";
import { ReportsView } from "@/components/dashboard/reports-view";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    date?: string;
    period?: string;
    tenant?: string;
  }>;
};

const VALID_TABS: PosTab[] = ["venta", "caja", "egreso", "historial", "reportes"];

function isValidTab(t: string | undefined): t is PosTab {
  return VALID_TABS.includes(t as PosTab);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-xl bg-card" />
      <div className="h-48 rounded-xl bg-card" />
      <div className="h-24 rounded-xl bg-card" />
    </div>
  );
}

export default async function PosPage({ searchParams }: PageProps) {
  const { tab: rawTab, date, period, tenant } = await searchParams;
  const tab: PosTab = isValidTab(rawTab) ? rawTab : "venta";

  const tabTitles: Record<PosTab, { title: string; description: string }> = {
    venta:     { title: "Punto de Venta",  description: "Registra cobros de servicios y productos" },
    caja:      { title: "Caja del día",    description: "Arqueo de ingresos y egresos de la jornada" },
    egreso:    { title: "Registrar egreso", description: "Anota gastos operativos: insumos, servicios, nómina" },
    historial: { title: "Historial",       description: "Resumen mensual de cobros y análisis financiero" },
    reportes:  { title: "Informes",        description: "Ingresos, citas, servicios y próximas fechas críticas" },
  };

  const { title, description } = tabTitles[tab];

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        icon={Wallet}
        tint="bg-teal-500/15 text-teal-400"
      />

      {/* Tab navigation — client (needs useSearchParams) */}
      <Suspense fallback={null}>
        <PosTabs active={tab} />
      </Suspense>

      {/* Tab content */}
      {tab === "venta" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <SaleForm />
        </Suspense>
      )}

      {tab === "caja" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <CashboxView date={date} tenant={tenant} />
        </Suspense>
      )}

      {tab === "egreso" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <ExpenseForm />
        </Suspense>
      )}

      {tab === "historial" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <RevenueHistory period={period} tenant={tenant} />
        </Suspense>
      )}

      {tab === "reportes" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <ReportsView />
        </Suspense>
      )}
    </div>
  );
}
