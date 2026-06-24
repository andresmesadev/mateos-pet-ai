import { redirect } from "next/navigation";

export default function ReportsPage() {
  redirect("/dashboard/pos?tab=reportes");
}
