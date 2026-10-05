import { TransactionHistory } from "./transaction-history";
import { type ReportDetail } from "@/lib/pos-reports";

export function RevenueHistory({ period, tenant, reportDetail }: { period?: string; tenant?: string; reportDetail?: ReportDetail }) {
  const current = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);
  return <TransactionHistory key={`${tenant || "current"}:${period || current}:${JSON.stringify(reportDetail)}`} period={period || current} reportDetail={reportDetail} />;
}
