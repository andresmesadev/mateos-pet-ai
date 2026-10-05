"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/use-tenant";
import { reportReturnUrl, type ReportDetail } from "@/lib/pos-reports";

export function ReportDetailContext({ detail }: { detail: ReportDetail }) {
  const tenant = useTenant();
  return <aside className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><div><p className="text-sm font-semibold">Desde Reportes · {detail.kind === "review" ? "Cobros por revisar" : detail.kind === "expense" ? "Gastos activos" : "Ingresos activos"}</p><p className="mt-1 text-xs text-muted-foreground">Fechas del reporte: {detail.from} al {detail.to}. Los filtros iniciales excluyen anulaciones.</p></div><Button asChild variant="outline"><Link href={reportReturnUrl(detail.selection, tenant)}><ArrowLeft />Volver a Reportes</Link></Button></aside>;
}
