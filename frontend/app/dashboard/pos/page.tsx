import { Suspense } from "react";
import { connection } from "next/server";
import { Wallet } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PosTabs, type PosTab } from "@/components/dashboard/pos/pos-tabs";
import { SaleForm } from "@/components/dashboard/pos/sale-form";
import { ExpenseWorkspace } from "@/components/dashboard/pos/expense-workspace";
import { CashboxView } from "@/components/dashboard/pos/cashbox-view";
import { RevenueHistory } from "@/components/dashboard/pos/revenue-history";
import { ReportsView } from "@/components/dashboard/reports-view";
import { OperationalCash } from "@/components/dashboard/pos/operational-cash";
import { getDashboardAccess } from "@/lib/dashboard-access-server";
import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { readReportDetail, readReportSelection } from "@/lib/pos-reports";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    date?: string;
    period?: string;
    tenant?: string;
    from?: string; to?: string; source?: string; detail?: string;
    reportPeriod?: string; reportOffset?: string; comparison?: string; offset?: string;
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
  const params = await searchParams;
  const { tab: rawTab, date, period, tenant } = params;
  const reportDetail = readReportDetail(params);
  const reportSelection = readReportSelection(params);
  const access = await getDashboardAccess(tenant);
  const tab: PosTab = isValidTab(rawTab) && (access.capabilities.finance || ["venta", "caja"].includes(rawTab)) ? rawTab : "venta";
  let draftScope: string | null = null;
  if (tab === "venta" || tab === "egreso") {
    try {
      const response = await fetch(apiUrl("/api/dashboard/cash/context"), { headers: makeServerHeaders(await auth(), tenant), cache: "no-store" });
      if (response.ok) draftScope = (await response.json()).draftScope;
    } catch { /* Sale remains usable with an explicit draft warning. */ }
  }

  const tabTitles: Record<PosTab, { title: string; description: string }> = {
    venta:     { title: "Punto de venta",     description: access.capabilities.retail ? "Prepara la venta, revisa el total y confirma el pago." : "Prepara el cobro del servicio y confirma el pago." },
    caja:      { title: "Caja diaria",    description: access.capabilities.finance ? "Revisa los ingresos, gastos y el saldo de la jornada." : "Consulta los cobros registrados y los servicios por revisar hoy." },
    egreso:    { title: "Gastos", description: "Registra gastos y consulta sus antecedentes y anulaciones." },
    historial: { title: "Historial de cobros", description: "Consulta ventas, cobros de citas y comprobantes. Las anulaciones conservan el registro original." },
    reportes:  { title: "Reportes",       description: "Revisa ingresos, citas y servicios." },
  };

  const { title, description } = tabTitles[tab];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Punto de venta"
        description={tab === "venta" ? description : access.capabilities.finance ? "Registra movimientos y consulta el estado de tu negocio." : "Registra cobros y revisa los movimientos de tu jornada."}
        icon={Wallet}
        tint="bg-teal-100 text-teal-700"
      />

      {/* Tab navigation — client (needs useSearchParams) */}
      <Suspense fallback={null}>
        <PosTabs active={tab} />
      </Suspense>

      {tab !== "venta" && tab !== "reportes" && <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>}

      {/* Tab content */}
      {tab === "venta" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <SaleForm key={draftScope ?? tenant ?? "no-draft"} draftScope={draftScope} />
        </Suspense>
      )}

      {tab === "caja" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <OperationalCash />
          {access.capabilities.finance && <CashboxView date={date} tenant={tenant} />}
        </Suspense>
      )}

      {tab === "egreso" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <ExpenseWorkspace key={`${draftScope ?? tenant ?? "no-expense-scope"}:${JSON.stringify(reportDetail)}`} scope={draftScope} defaultResponsible={(await auth())?.user.name ?? ""} reportDetail={reportDetail?.kind === "expense" ? reportDetail : undefined} />
        </Suspense>
      )}

      {tab === "historial" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <RevenueHistory period={period} tenant={tenant} reportDetail={reportDetail?.kind !== "expense" ? reportDetail : undefined} />
        </Suspense>
      )}

      {tab === "reportes" && (
        <Suspense fallback={<LoadingSkeleton />}>
          <ReportsView key={`${tenant}:${JSON.stringify(reportSelection)}`} initial={reportSelection} />
        </Suspense>
      )}
    </div>
  );
}
