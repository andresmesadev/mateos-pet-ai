import { Suspense } from "react";
import { connection } from "next/server";
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
  await connection();
  const { tab: rawTab, date, period, tenant } = await searchParams;
  const tab: PosTab = isValidTab(rawTab) ? rawTab : "venta";

  const tabTitles: Record<PosTab, { title: string; description: string }> = {
    venta:     { title: "Nueva venta",     description: "Registra el cobro de un servicio o producto." },
    caja:      { title: "Caja del día",    description: "Revisa los ingresos, egresos y el saldo de la jornada." },
    egreso:    { title: "Registrar egreso", description: "Anota un gasto operativo." },
    historial: { title: "Historial de ventas", description: "Consulta los cobros de meses anteriores." },
    reportes:  { title: "Reportes",       description: "Revisa ingresos, citas y servicios." },
  };

  const { title, description } = tabTitles[tab];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Caja y ventas"
        description="Registra movimientos y consulta el estado de tu negocio."
        icon={Wallet}
        tint="bg-teal-100 text-teal-700"
      />

      {/* Tab navigation — client (needs useSearchParams) */}
      <Suspense fallback={null}>
        <PosTabs active={tab} />
      </Suspense>

      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

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
